package apistore

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"mime"
	"net/http"
	"testing"
	"testing/synctest"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourceclient"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type inlineBlobClient struct {
	resourceclient.ResourceClient
	puts       []*resourcepb.PutBlobRequest
	value      []byte
	writes     int
	put        func(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error)
	writeError error
	conflict   bool
}

func (c *inlineBlobClient) PutBlob(ctx context.Context, req *resourcepb.PutBlobRequest, _ ...grpc.CallOption) (*resourcepb.PutBlobResponse, error) {
	c.puts = append(c.puts, req)
	if c.put != nil {
		return c.put(ctx, req)
	}
	return &resourcepb.PutBlobResponse{Uid: "uploaded", Size: int64(len(req.Value)), MimeType: "application/json", Charset: "utf-8", Hash: "server-hash"}, nil
}

func (c *inlineBlobClient) Create(_ context.Context, req *resourcepb.CreateRequest, _ ...grpc.CallOption) (*resourcepb.CreateResponse, error) {
	c.writes++
	if c.writeError != nil {
		return nil, c.writeError
	}
	c.value = req.Value
	return &resourcepb.CreateResponse{ResourceVersion: 1}, nil
}

func (c *inlineBlobClient) Read(context.Context, *resourcepb.ReadRequest, ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	if c.value == nil {
		return nil, status.Error(codes.NotFound, "not found")
	}
	return &resourcepb.ReadResponse{Value: c.value, ResourceVersion: 1}, nil
}

func (c *inlineBlobClient) List(context.Context, *resourcepb.ListRequest, ...grpc.CallOption) (*resourcepb.ListResponse, error) {
	return &resourcepb.ListResponse{Items: []*resourcepb.ResourceWrapper{{Value: c.value, ResourceVersion: 1}}, ResourceVersion: 1}, nil
}

func (c *inlineBlobClient) Update(_ context.Context, req *resourcepb.UpdateRequest, _ ...grpc.CallOption) (*resourcepb.UpdateResponse, error) {
	c.writes++
	if c.conflict && c.writes == 1 {
		return &resourcepb.UpdateResponse{Error: &resourcepb.ErrorResult{Code: http.StatusConflict, Message: "conflict"}}, nil
	}
	if c.writeError != nil {
		return nil, c.writeError
	}
	c.value = req.Value
	return &resourcepb.UpdateResponse{ResourceVersion: 2}, nil
}

func inlineBlobObject(t *testing.T) *unstructured.Unstructured {
	t.Helper()
	obj := &unstructured.Unstructured{}
	require.NoError(t, obj.UnmarshalJSON(testObject(t)))
	obj.Object["spec"] = map[string]any{"number": int64(9007199254740993)}
	obj.Object["blobs"] = map[string]any{
		"dashboard": map[string]any{"contentType": "application/json", "data": "e30="},
		"existing":  map[string]any{"uid": "old", "extension": map[string]any{"data": "not inline"}},
	}
	obj.SetAnnotations(map[string]string{utils.AnnoKeyKubectlLastAppliedConfig: `{"blobs":{"dashboard":{"data":"e30="}}}`, "keep": "yes"})
	return obj
}

func TestInlineBlobsCreateAndRead(t *testing.T) {
	ctx := testContext(t)
	client := &inlineBlobClient{}
	s := testStorage(t, client)
	s.opts.EnableInlineBlobs = true
	obj := inlineBlobObject(t)
	s.opts.EnableFolderSupport = true
	annotations := obj.GetAnnotations()
	annotations[utils.AnnoKeyFolder] = "folder-1"
	obj.SetAnnotations(annotations)
	out := &unstructured.Unstructured{}
	require.NoError(t, s.Create(ctx, "test", obj, out, 0))
	require.Len(t, client.puts, 1)
	put := client.puts[0]
	require.Equal(t, "{}", string(put.Value))
	require.Equal(t, resourcepb.PutBlobRequest_GRPC, put.Method)
	require.Equal(t, &resourcepb.ResourceKey{Namespace: "default", Group: "example.grafana.app", Resource: "examples", Name: "test"}, put.Resource)
	require.Equal(t, "application/json", put.ContentType)
	require.Equal(t, "folder-1", put.Folder)

	assertReference := func(obj *unstructured.Unstructured) {
		t.Helper()
		blob, found, err := unstructured.NestedMap(obj.Object, "blobs", "dashboard")
		require.NoError(t, err)
		require.True(t, found)
		require.Equal(t, map[string]any{"uid": "uploaded", "contentType": "application/json; charset=utf-8", "hash": "server-hash", "size": int64(2)}, blob)
		number, _, err := unstructured.NestedInt64(obj.Object, "spec", "number")
		require.NoError(t, err)
		require.Equal(t, int64(9007199254740993), number)
		require.NotContains(t, obj.GetAnnotations(), utils.AnnoKeyKubectlLastAppliedConfig)
		require.Equal(t, "yes", obj.GetAnnotations()["keep"])
		extension, _, err := unstructured.NestedString(obj.Object, "blobs", "existing", "extension", "data")
		require.NoError(t, err)
		require.Equal(t, "not inline", extension)
	}
	assertReference(out)
	stored := &unstructured.Unstructured{}
	require.NoError(t, stored.UnmarshalJSON(client.value))
	assertReference(stored)
	read := &unstructured.Unstructured{}
	require.NoError(t, s.Get(ctx, "test", storage.GetOptions{}, read))
	assertReference(read)
	list := &unstructured.UnstructuredList{}
	require.NoError(t, s.GetList(ctx, "test", storage.ListOptions{Predicate: storage.Everything}, list))
	require.Len(t, list.Items, 1)
	assertReference(&list.Items[0])

	// The legacy side of a dual-write must still see the original input.
	data, _, err := unstructured.NestedString(obj.Object, "blobs", "dashboard", "data")
	require.NoError(t, err)
	require.Equal(t, "e30=", data)
	require.Contains(t, obj.GetAnnotations(), utils.AnnoKeyKubectlLastAppliedConfig)
}

func TestInlineBlobsPreserveMediaTypeParameters(t *testing.T) {
	for _, operation := range []string{"create", "update"} {
		for _, serverCharset := range []string{"", "utf-8"} {
			t.Run(operation+"/charset="+serverCharset, func(t *testing.T) {
				const contentType = `application/ld+json; profile="https://example.com/profile"; charset=iso-8859-1`
				ctx := testContext(t)
				client := &inlineBlobClient{put: func(_ context.Context, req *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
					require.Equal(t, contentType, req.ContentType)
					return &resourcepb.PutBlobResponse{Uid: "uploaded", Size: int64(len(req.Value)), MimeType: "application/ld+json", Charset: serverCharset}, nil
				}}
				s := testStorage(t, client)
				s.opts.EnableInlineBlobs = true
				obj := inlineBlobObject(t)
				require.NoError(t, unstructured.SetNestedField(obj.Object, contentType, "blobs", "dashboard", "contentType"))
				out := &unstructured.Unstructured{}
				if operation == "create" {
					require.NoError(t, s.Create(ctx, "test", obj, out, 0))
				} else {
					client.value = testObject(t)
					require.NoError(t, s.GuaranteedUpdate(ctx, "test", out, false, &storage.Preconditions{}, func(runtime.Object, storage.ResponseMeta) (runtime.Object, *uint64, error) {
						return obj, nil, nil
					}, nil))
				}
				stored := &unstructured.Unstructured{}
				require.NoError(t, stored.UnmarshalJSON(client.value))
				for _, result := range []*unstructured.Unstructured{stored, out} {
					value, found, err := unstructured.NestedString(result.Object, "blobs", "dashboard", "contentType")
					require.NoError(t, err)
					require.True(t, found)
					mediaType, params, err := mime.ParseMediaType(value)
					require.NoError(t, err)
					require.Equal(t, "application/ld+json", mediaType)
					charset := serverCharset
					if charset == "" {
						charset = "iso-8859-1"
					}
					require.Equal(t, map[string]string{"profile": "https://example.com/profile", "charset": charset}, params)
				}
			})
		}
	}
}

func TestInlineBlobsValidateBeforeUploading(t *testing.T) {
	for _, blobs := range []string{
		`{"a":{"contentType":"application/json","data":"e30="},"z":{"data":null}}`,
		`{"dashboard":{"uid":"old","data":"e30="}}`,
		`{"dashboard":{"data":null}}`,
		`{"dashboard":{"data":""}}`,
		`{"dashboard":{"contentType":"application/json","data":"invalid"}}`,
		`{"dashboard":{"contentType":"application/json","data":"e30=","hash":"untrusted"}}`,
		`{"dashboard":{"contentType":"application/json","data":"e30="},"dashboard":{"uid":"old"}}`,
	} {
		t.Run(blobs, func(t *testing.T) {
			client := &inlineBlobClient{}
			s := testStorage(t, client)
			s.opts.EnableInlineBlobs = true
			raw := json.RawMessage(`{"metadata":{"name":"test"},"blobs":` + blobs + `}`)
			_, err := s.prepareInlineBlobs(testContext(t), raw, &resourcepb.ResourceKey{}, inlineBlobObject(t))
			require.True(t, apierrors.IsBadRequest(err), "%v", err)
			require.Empty(t, client.puts)
		})
	}
}

func TestInlineBlobsPreserveEmptyUIDReference(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		for _, operation := range []string{"create", "update"} {
			t.Run(fmt.Sprintf("enabled=%t/%s", enabled, operation), func(t *testing.T) {
				client := &inlineBlobClient{}
				s := testStorage(t, client)
				s.opts.EnableInlineBlobs = enabled
				obj := inlineBlobObject(t)
				obj.Object["blobs"] = map[string]any{"dashboard": map[string]any{"uid": ""}}
				out := &unstructured.Unstructured{}
				if operation == "create" {
					require.NoError(t, s.Create(testContext(t), "test", obj, out, 0))
				} else {
					client.value = testObject(t)
					require.NoError(t, s.GuaranteedUpdate(testContext(t), "test", out, false, &storage.Preconditions{}, func(runtime.Object, storage.ResponseMeta) (runtime.Object, *uint64, error) {
						return obj, nil, nil
					}, nil))
				}
				require.Empty(t, client.puts)
				uid, found, err := unstructured.NestedString(out.Object, "blobs", "dashboard", "uid")
				require.NoError(t, err)
				require.True(t, found)
				require.Empty(t, uid)
			})
		}
	}
}

func TestInlineBlobsPreserveLooseReferencesWithInlineData(t *testing.T) {
	client := &inlineBlobClient{}
	s := testStorage(t, client)
	s.opts.EnableInlineBlobs = true
	obj := inlineBlobObject(t)
	obj.Object["blobs"].(map[string]any)["existing"] = map[string]any{"uid": "", "size": "legacy", "extension": true}
	out := &unstructured.Unstructured{}
	require.NoError(t, s.Create(testContext(t), "test", obj, out, 0))
	require.Len(t, client.puts, 1)
	reference, found, err := unstructured.NestedMap(out.Object, "blobs", "existing")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, obj.Object["blobs"].(map[string]any)["existing"], reference)
}

func TestInlineBlobsDisabledAndReferenceOnly(t *testing.T) {
	client := &inlineBlobClient{}
	s := testStorage(t, client)
	err := s.Create(testContext(t), "test", inlineBlobObject(t), &unstructured.Unstructured{}, 0)
	require.True(t, apierrors.IsBadRequest(err))
	require.Empty(t, client.puts)
	require.Zero(t, client.writes)
	for _, data := range []string{`null`, `""`} {
		_, err := s.prepareInlineBlobs(testContext(t), json.RawMessage(`{"blobs":{"dashboard":{"data":`+data+`}}}`), nil, nil)
		require.True(t, apierrors.IsBadRequest(err))
	}
	for _, raw := range []string{`{"spec":{}}`, `{"blobs":null}`, `{"blobs":{}}`, `{"blobs":{"dashboard":{"uid":"old","custom":true}}}`, `{"blobs":{"dashboard":{"uid":""}}}`, `{"blobs":{"dashboard":null,"existing":{}}}`, `{"blobs":{"dashboard":{"uid":"","size":"legacy"}}}`} {
		actual, err := s.prepareInlineBlobs(testContext(t), json.RawMessage(raw), nil, nil)
		require.NoError(t, err)
		require.Equal(t, raw, string(actual))
	}
}

func TestInlineBlobsUploadFailurePreventsWrite(t *testing.T) {
	failure := &resourcepb.ErrorResult{Code: http.StatusServiceUnavailable, Message: "unavailable"}
	for name, put := range map[string]func(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error){
		"transport": func(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
			return nil, status.Error(codes.Unavailable, "unavailable")
		},
		"embedded": func(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
			return &resourcepb.PutBlobResponse{Error: failure}, nil
		},
		"both": func(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
			return &resourcepb.PutBlobResponse{Error: failure}, status.Error(codes.PermissionDenied, "denied")
		},
		"unsupported": func(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
			return nil, status.Error(codes.Unimplemented, "unsupported")
		},
		"nil": func(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
			return nil, nil
		},
		"missing uid": func(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
			return &resourcepb.PutBlobResponse{Size: 2, MimeType: "application/json"}, nil
		},
		"wrong size": func(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
			return &resourcepb.PutBlobResponse{Uid: "bad", Size: 1, MimeType: "application/json"}, nil
		},
		"missing type": func(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
			return &resourcepb.PutBlobResponse{Uid: "bad", Size: 2}, nil
		},
		"invalid type": func(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
			return &resourcepb.PutBlobResponse{Uid: "bad", Size: 2, MimeType: "application/json; invalid"}, nil
		},
		"mismatched type": func(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
			return &resourcepb.PutBlobResponse{Uid: "bad", Size: 2, MimeType: "text/plain"}, nil
		},
	} {
		t.Run(name, func(t *testing.T) {
			client := &inlineBlobClient{put: put}
			s := testStorage(t, client)
			s.opts.EnableInlineBlobs = true
			err := s.Create(testContext(t), "test", inlineBlobObject(t), &unstructured.Unstructured{}, 0)
			require.Error(t, err)
			if name == "both" {
				require.True(t, apierrors.IsForbidden(err), "%v", err)
			}
			require.Zero(t, client.writes)
		})
	}
}

func TestInlineBlobsPartialUploadFailure(t *testing.T) {
	client := &inlineBlobClient{}
	client.put = func(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
		if len(client.puts) == 2 {
			return nil, status.Error(codes.Unavailable, "second upload failed")
		}
		return &resourcepb.PutBlobResponse{Uid: "first", Size: 2, MimeType: "application/json"}, nil
	}
	s := testStorage(t, client)
	s.opts.EnableInlineBlobs = true
	obj := inlineBlobObject(t)
	require.NoError(t, unstructured.SetNestedMap(obj.Object, map[string]any{"contentType": "application/json", "data": "e30="}, "blobs", "second"))
	err := s.Create(testContext(t), "test", obj, &unstructured.Unstructured{}, 0)
	require.Error(t, err)
	require.Len(t, client.puts, 2)
	require.Zero(t, client.writes)
	require.Contains(t, obj.Object["blobs"].(map[string]any)["dashboard"], "data")
}

func TestInlineBlobsWriteFailureAndCancellation(t *testing.T) {
	for _, update := range []bool{false, true} {
		for _, cancel := range []bool{false, true} {
			t.Run(fmt.Sprintf("update=%t/cancel=%t", update, cancel), func(t *testing.T) {
				client := &inlineBlobClient{writeError: status.Error(codes.Unavailable, "ambiguous write")}
				s := testStorage(t, client)
				s.opts.EnableInlineBlobs = true
				ctx := testContext(t)
				if cancel {
					var cancelFunc context.CancelFunc
					ctx, cancelFunc = context.WithCancel(ctx)
					defer cancelFunc()
					client.put = func(ctx context.Context, _ *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
						cancelFunc()
						return nil, ctx.Err()
					}
				}
				out := &unstructured.Unstructured{}
				var err error
				if update {
					client.value = testObject(t)
					err = s.GuaranteedUpdate(ctx, "test", out, false, &storage.Preconditions{}, func(runtime.Object, storage.ResponseMeta) (runtime.Object, *uint64, error) {
						return inlineBlobObject(t), nil, nil
					}, nil)
				} else {
					err = s.Create(ctx, "test", inlineBlobObject(t), out, 0)
				}
				require.Error(t, err)
				require.Len(t, client.puts, 1)
				if cancel {
					require.Zero(t, client.writes)
					require.True(t, errors.Is(ctx.Err(), context.Canceled))
				} else {
					require.Equal(t, 1, client.writes)
				}
			})
		}
	}
}

func TestInlineBlobsDryRunDoesNotUpload(t *testing.T) {
	client := &inlineBlobClient{}
	s := testStorage(t, client)
	s.opts.EnableInlineBlobs = true
	// Dry-run is above apistore. Resources opting in must redact its response
	// at their REST boundary; this test only guards against upload side effects.
	dry := &registry.DryRunnableStorage{Storage: s, Codec: unstructured.UnstructuredJSONScheme}
	require.NoError(t, dry.Create(testContext(t), "test", inlineBlobObject(t), &unstructured.Unstructured{}, 0, true))
	require.Empty(t, client.puts)
	require.Zero(t, client.writes)
}

func TestInlineBlobsUpdateRetries(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		client := &inlineBlobClient{conflict: true}
		s := testStorage(t, client)
		s.opts.EnableInlineBlobs = true
		previous := inlineBlobObject(t)
		previous.Object["blobs"] = map[string]any{"dashboard": map[string]any{"uid": "previous"}}
		previous.SetGeneration(4)
		var err error
		client.value, err = previous.MarshalJSON()
		require.NoError(t, err)
		out := &unstructured.Unstructured{}
		err = s.GuaranteedUpdate(testContext(t), "test", out, false, &storage.Preconditions{}, func(runtime.Object, storage.ResponseMeta) (runtime.Object, *uint64, error) {
			return inlineBlobObject(t), nil, nil
		}, nil)
		require.NoError(t, err)
		require.Equal(t, 2, client.writes)
		require.Len(t, client.puts, 2)
		require.Equal(t, int64(5), out.GetGeneration())
		_, found, err := unstructured.NestedFieldNoCopy(out.Object, "blobs", "dashboard", "data")
		require.NoError(t, err)
		require.False(t, found)
	})
}
