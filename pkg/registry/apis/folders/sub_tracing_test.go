package folders

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/codes"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func newFolderTrace(t *testing.T) (context.Context, *tracetest.SpanRecorder, trace.Span) {
	t.Helper()
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	previousTracer := tracer
	tracer = provider.Tracer("github.com/grafana/grafana/pkg/registry/apis/folders")
	ctx, span := provider.Tracer("test").Start(newChildrenCtx(), "request")
	t.Cleanup(func() {
		tracer = previousTracer
		span.End()
		require.NoError(t, provider.Shutdown(context.Background()))
	})
	return ctx, recorder, span
}

func folderSpan(t *testing.T, recorder *tracetest.SpanRecorder, name string) sdktrace.ReadOnlySpan {
	t.Helper()
	for _, span := range recorder.Ended() {
		if span.Name() == name {
			require.Equal(t, "github.com/grafana/grafana/pkg/registry/apis/folders", span.InstrumentationScope().Name)
			return span
		}
	}
	t.Fatalf("span %q not found", name)
	return nil
}

func requireFolderSpanError(t *testing.T, span sdktrace.ReadOnlySpan) {
	t.Helper()
	require.Equal(t, codes.Error, span.Status().Code)
	require.NotEmpty(t, span.Events())
	require.Equal(t, "exception", span.Events()[0].Name)
}

type tracingFolderGetter struct {
	get func(context.Context, string) (runtime.Object, error)
}

func (g tracingFolderGetter) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	return g.get(ctx, name)
}

type tracingFolderIndexClient struct {
	resourcepb.ResourceIndexClient
	span        trace.SpanContext
	callErr     error
	responseErr *resourcepb.ErrorResult
}

func (c *tracingFolderIndexClient) Search(ctx context.Context, _ *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	c.span = trace.SpanContextFromContext(ctx)
	return &resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES, Error: c.responseErr}, c.callErr
}

func (c *tracingFolderIndexClient) GetStats(ctx context.Context, _ *resourcepb.ResourceStatsRequest, _ ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	c.span = trace.SpanContextFromContext(ctx)
	return &resourcepb.ResourceStatsResponse{Error: c.responseErr}, c.callErr
}

func TestFolderIndexHandlerTracing(t *testing.T) {
	for _, endpoint := range []string{"children", "counts"} {
		for _, failure := range []string{"none", "call", "response", "lookup"} {
			t.Run(endpoint+"/"+failure, func(t *testing.T) {
				ctx, recorder, parent := newFolderTrace(t)
				client := &tracingFolderIndexClient{}
				if failure == "call" {
					client.callErr = errors.New("index unavailable")
				}
				if failure == "response" {
					client.responseErr = &resourcepb.ErrorResult{Code: http.StatusServiceUnavailable, Message: "index unavailable"}
				}
				var lookupContext trace.SpanContext
				var lookupStart, lookupEnd time.Time
				getter := tracingFolderGetter{get: func(ctx context.Context, _ string) (runtime.Object, error) {
					lookupContext = trace.SpanContextFromContext(ctx)
					lookupStart = time.Now()
					defer func() { lookupEnd = time.Now() }()
					if failure == "lookup" {
						return nil, errors.New("folder unavailable")
					}
					return &folderv1.Folder{}, nil
				}}
				var handler rest.Connecter = &subChildrenREST{getter: getter, searcher: client}
				prefix := "folders.subChildrenREST.Connect"
				childName := prefix + ".Search"
				if endpoint == "counts" {
					handler = &subCountREST{getter: getter, searcher: client}
					prefix = "folders.subCountREST.Connect"
					childName = "folders.subCountREST.getStats"
				}
				responder := &recordingResponder{}
				h, err := handler.Connect(ctx, "folder", nil, responder)
				if failure == "lookup" {
					require.Error(t, err)
					require.Nil(t, h)
				} else {
					require.NoError(t, err)
					require.Empty(t, recorder.Ended(), "handler span must remain open until handler completion")
					h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/folder/"+endpoint, nil))
				}
				outer := folderSpan(t, recorder, prefix)
				require.Equal(t, parent.SpanContext().SpanID(), outer.Parent().SpanID())
				require.Equal(t, outer.SpanContext(), lookupContext)
				require.False(t, outer.StartTime().After(lookupStart))
				require.False(t, outer.EndTime().Before(lookupEnd))
				if failure == "lookup" {
					requireFolderSpanError(t, outer)
					require.Len(t, recorder.Ended(), 1)
					return
				}
				child := folderSpan(t, recorder, childName)
				require.Equal(t, parent.SpanContext().TraceID(), child.SpanContext().TraceID())
				require.Equal(t, outer.SpanContext().SpanID(), child.Parent().SpanID())
				require.Equal(t, child.SpanContext(), client.span)
				require.Len(t, recorder.Ended(), 2)
				if failure == "none" {
					require.NoError(t, responder.err)
					require.Equal(t, codes.Unset, outer.Status().Code)
					require.Equal(t, codes.Unset, child.Status().Code)
				} else {
					require.Error(t, responder.err)
					requireFolderSpanError(t, outer)
					requireFolderSpanError(t, child)
				}
			})
		}
	}
}

func TestFolderAccessHandlerTracing(t *testing.T) {
	for _, failure := range []string{"none", "call", "result", "lookup"} {
		t.Run(failure, func(t *testing.T) {
			ctx, recorder, parent := newFolderTrace(t)
			ctx = identity.WithRequester(ctx, &user.SignedInUser{UserID: 1, OrgID: 1})
			var mu sync.Mutex
			var batchContexts []trace.SpanContext
			client := &subAccessMockClient{batchCheckFunc: func(ctx context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
				mu.Lock()
				batchContexts = append(batchContexts, trace.SpanContextFromContext(ctx))
				mu.Unlock()
				if failure == "call" {
					return authlib.BatchCheckResponse{}, errors.New("authorization unavailable")
				}
				results := make(map[string]authlib.BatchCheckResult)
				for _, check := range req.Checks {
					result := authlib.BatchCheckResult{Allowed: true}
					if failure == "result" && check.CorrelationID == itemErrProbe {
						result.Error = errors.New("probe failed")
					}
					results[check.CorrelationID] = result
				}
				return authlib.BatchCheckResponse{Results: results}, nil
			}}
			var lookupContext trace.SpanContext
			getter := tracingFolderGetter{get: func(ctx context.Context, _ string) (runtime.Object, error) {
				lookupContext = trace.SpanContextFromContext(ctx)
				if failure == "lookup" {
					return nil, errors.New("folder unavailable")
				}
				return &folderv1.Folder{}, nil
			}}
			handler := &subAccessREST{getter: getter, accessClient: client}
			responder := &recordingResponder{}
			h, err := handler.Connect(ctx, "folder", nil, responder)
			require.NoError(t, err)
			h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/folder/access", nil))
			outer := folderSpan(t, recorder, "folders.subAccessREST.Connect")
			require.Equal(t, parent.SpanContext().SpanID(), outer.Parent().SpanID())
			require.Equal(t, outer.SpanContext(), lookupContext)
			if failure == "lookup" {
				require.Error(t, responder.err)
				requireFolderSpanError(t, outer)
				require.Empty(t, batchContexts)
				require.Len(t, recorder.Ended(), 1)
				return
			}
			require.Len(t, batchContexts, len(folderAccessProbeBatches))
			require.Len(t, recorder.Ended(), len(folderAccessProbeBatches)+1)
			failedBatches := 0
			for _, span := range recorder.Ended() {
				if span.Name() != "folders.subAccessREST.checkAccess.BatchCheck" {
					continue
				}
				require.Equal(t, "github.com/grafana/grafana/pkg/registry/apis/folders", span.InstrumentationScope().Name)
				require.Equal(t, outer.SpanContext().SpanID(), span.Parent().SpanID())
				require.Equal(t, parent.SpanContext().TraceID(), span.SpanContext().TraceID())
				require.Contains(t, batchContexts, span.SpanContext())
				require.Len(t, span.Attributes(), 3)
				if span.Status().Code == codes.Error {
					failedBatches++
					requireFolderSpanError(t, span)
				}
			}
			if failure == "none" {
				require.NoError(t, responder.err)
				require.Zero(t, failedBatches)
				require.Equal(t, codes.Unset, outer.Status().Code)
			} else {
				require.Error(t, responder.err)
				requireFolderSpanError(t, outer)
				if failure == "call" {
					require.Equal(t, len(folderAccessProbeBatches), failedBatches)
				} else {
					require.Equal(t, 1, failedBatches)
				}
			}
		})
	}
}

func TestFolderParentsHandlerTracing(t *testing.T) {
	for _, detached := range []bool{false, true} {
		t.Run(map[bool]string{false: "success", true: "detached"}[detached], func(t *testing.T) {
			ctx, recorder, parent := newFolderTrace(t)
			contexts := make(map[string]trace.SpanContext)
			getter := tracingFolderGetter{get: func(ctx context.Context, name string) (runtime.Object, error) {
				contexts[name] = trace.SpanContextFromContext(ctx)
				if name == "parent" && detached {
					return nil, errors.New("parent unavailable")
				}
				f := &folderv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: name}}
				if name == "folder" {
					f.Annotations = map[string]string{utils.AnnoKeyFolder: "parent"}
				}
				return f, nil
			}}
			handler := &subParentsREST{getter: getter, parents: newParentsGetter(getter)}
			responder := &recordingResponder{}
			h, err := handler.Connect(ctx, "folder", nil, responder)
			require.NoError(t, err)
			h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/folder/parents", nil))
			require.NoError(t, responder.err)
			outer := folderSpan(t, recorder, "folders.subParentsREST.Connect")
			traversal := folderSpan(t, recorder, "folders.getParents")
			require.Len(t, recorder.Ended(), 2)
			require.Equal(t, parent.SpanContext().SpanID(), outer.Parent().SpanID())
			require.Equal(t, outer.SpanContext().SpanID(), traversal.Parent().SpanID())
			require.Equal(t, outer.SpanContext(), contexts["folder"])
			require.Equal(t, traversal.SpanContext(), contexts["parent"])
			require.Equal(t, codes.Unset, outer.Status().Code)
			items := responder.obj.(*folderv1.FolderInfoList).Items
			require.Len(t, items, 2)
			require.Equal(t, detached, items[0].Detached)
			if detached {
				requireFolderSpanError(t, traversal)
			} else {
				require.Equal(t, codes.Unset, traversal.Status().Code)
			}
		})
	}
}

func TestFolderParentsGetterTracing(t *testing.T) {
	for _, scenario := range []string{"success", "detached", "invalid", "cycle", "general", "sharedwithme"} {
		t.Run(scenario, func(t *testing.T) {
			ctx, recorder, parent := newFolderTrace(t)
			var lookupContexts []trace.SpanContext
			getter := tracingFolderGetter{get: func(ctx context.Context, name string) (runtime.Object, error) {
				lookupContexts = append(lookupContexts, trace.SpanContextFromContext(ctx))
				switch scenario {
				case "detached":
					return nil, errors.New("parent unavailable")
				case "invalid":
					return &metav1.Status{}, nil
				}
				f := &folderv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: name}}
				if name == "parent" {
					ancestor := "root"
					if scenario == "cycle" {
						ancestor = "folder"
					}
					f.Annotations = map[string]string{utils.AnnoKeyFolder: ancestor}
				}
				return f, nil
			}}
			f := &folderv1.Folder{ObjectMeta: metav1.ObjectMeta{
				Name:        "folder",
				Annotations: map[string]string{utils.AnnoKeyFolder: "parent"},
			}}
			switch scenario {
			case "general":
				f.Name = folder.GeneralFolderUID
			case "sharedwithme":
				f.Name = folder.SharedWithMeFolderUID
			}
			info, err := newParentsGetter(getter)(ctx, f)
			traversal := folderSpan(t, recorder, "folders.getParents")
			require.Len(t, recorder.Ended(), 1)
			require.Equal(t, parent.SpanContext().SpanID(), traversal.Parent().SpanID())
			require.Equal(t, parent.SpanContext().TraceID(), traversal.SpanContext().TraceID())
			for _, lookupContext := range lookupContexts {
				require.Equal(t, traversal.SpanContext(), lookupContext)
			}
			switch scenario {
			case "cycle":
				require.Error(t, err)
				require.Nil(t, info)
				require.Len(t, lookupContexts, 1)
				requireFolderSpanError(t, traversal)
			case "detached", "invalid":
				require.NoError(t, err)
				require.Len(t, info.Items, 2)
				require.True(t, info.Items[0].Detached)
				require.Len(t, lookupContexts, 1)
				requireFolderSpanError(t, traversal)
			case "general", "sharedwithme":
				require.NoError(t, err)
				require.Len(t, info.Items, 1)
				require.Empty(t, lookupContexts)
				require.Equal(t, codes.Unset, traversal.Status().Code)
			default:
				require.NoError(t, err)
				require.Len(t, info.Items, 3)
				require.Len(t, lookupContexts, 2)
				require.Equal(t, codes.Unset, traversal.Status().Code)
			}
		})
	}
}
