package resource

import (
	"bytes"
	context "context"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"gocloud.dev/blob"
	_ "gocloud.dev/blob/fileblob"
	_ "gocloud.dev/blob/memblob"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type CDKBackendOptions struct {
	Tracer     trace.Tracer
	Bucket     *blob.Bucket
	RootFolder string
}

func NewCDKBackend(ctx context.Context, opts CDKBackendOptions) (StorageBackend, error) {
	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("cdk-appending-store")
	}

	if opts.Bucket == nil {
		return nil, fmt.Errorf("missing bucket")
	}

	found, _, err := opts.Bucket.ListPage(ctx, blob.FirstPageToken, 1, &blob.ListOptions{
		Prefix:    opts.RootFolder,
		Delimiter: "/",
	})
	if err != nil {
		return nil, err
	}
	if found == nil {
		return nil, fmt.Errorf("the root folder does not exist")
	}

	backend := &cdkBackend{
		tracer: opts.Tracer,
		bucket: opts.Bucket,
		root:   opts.RootFolder,
	}
	backend.rv.Swap(time.Now().UnixMilli())
	return backend, nil
}

type cdkBackend struct {
	tracer trace.Tracer
	bucket *blob.Bucket
	root   string

	mutex sync.Mutex
	rv    atomic.Int64

	// Simple watch stream -- NOTE, this only works for single tenant!
	broadcaster Broadcaster[*WrittenEvent]
	stream      chan<- *WrittenEvent
}

func (s *cdkBackend) getPath(key *ResourceKey, rv int64) string {
	var buffer bytes.Buffer
	buffer.WriteString(s.root)

	if key.Group == "" {
		return buffer.String()
	}
	buffer.WriteString(key.Group)

	if key.Resource == "" {
		return buffer.String()
	}
	buffer.WriteString("/")
	buffer.WriteString(key.Resource)

	if key.Namespace == "" {
		if key.Name == "" {
			return buffer.String()
		}
		buffer.WriteString("/__cluster__")
	} else {
		buffer.WriteString("/")
		buffer.WriteString(key.Namespace)
	}

	if key.Name == "" {
		return buffer.String()
	}
	buffer.WriteString("/")
	buffer.WriteString(key.Name)

	if rv > 0 {
		buffer.WriteString(fmt.Sprintf("/%d.json", rv))
	}
	return buffer.String()
}

func (s *cdkBackend) WriteEvent(ctx context.Context, event WriteEvent) (rv int64, err error) {
	// Scope the lock
	{
		s.mutex.Lock()
		defer s.mutex.Unlock()

		rv = s.rv.Add(1)
		err = s.bucket.WriteAll(ctx, s.getPath(event.Key, rv), event.Value, &blob.WriterOptions{
			ContentType: "application/json",
		})
	}

	// Async notify all subscribers
	if s.stream != nil {
		go func() {
			write := &WrittenEvent{
				WriteEvent:      event,
				Timestamp:       time.Now().UnixMilli(),
				ResourceVersion: rv,
			}
			s.stream <- write
		}()
	}
	return rv, err
}

func (s *cdkBackend) Read(ctx context.Context, req *ReadRequest) (*ReadResponse, error) {
	rv := req.ResourceVersion

	path := s.getPath(req.Key, rv)
	if rv < 1 {
		iter := s.bucket.List(&blob.ListOptions{Prefix: path + "/", Delimiter: "/"})
		for {
			obj, err := iter.Next(ctx)
			if err == io.EOF {
				break
			}
			if strings.HasSuffix(obj.Key, ".json") {
				idx := strings.LastIndex(obj.Key, "/") + 1
				edx := strings.LastIndex(obj.Key, ".")
				if idx > 0 {
					v, err := strconv.ParseInt(obj.Key[idx:edx], 10, 64)
					if err == nil && v > rv {
						rv = v
						path = obj.Key // find the path with biggest resource version
					}
				}
			}
		}
	}

	raw, err := s.bucket.ReadAll(ctx, path)
	if raw == nil && req.ResourceVersion > 0 {
		if req.ResourceVersion > s.rv.Load() {
			return nil, &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Reason:  metav1.StatusReasonTimeout, // match etcd behavior
					Code:    http.StatusGatewayTimeout,
					Message: "ResourceVersion is larger than max",
					Details: &metav1.StatusDetails{
						Causes: []metav1.StatusCause{
							{
								Type:    metav1.CauseTypeResourceVersionTooLarge,
								Message: fmt.Sprintf("requested: %d, current %d", req.ResourceVersion, s.rv.Load()),
							},
						},
					},
				},
			}
		}

		// If the there was an explicit request, get the latest
		rsp, _ := s.Read(ctx, &ReadRequest{Key: req.Key})
		if rsp != nil && len(rsp.Value) > 0 {
			raw = rsp.Value
			rv = rsp.ResourceVersion
			err = nil
		}
	}
	if err == nil && isDeletedMarker(raw) {
		raw = nil
	}
	if raw == nil {
		return nil, apierrors.NewNotFound(schema.GroupResource{
			Group:    req.Key.Group,
			Resource: req.Key.Resource,
		}, req.Key.Name)
	}
	return &ReadResponse{
		ResourceVersion: rv,
		Value:           raw,
	}, err
}

func isDeletedMarker(raw []byte) bool {
	if bytes.Contains(raw, []byte(`"DeletedMarker"`)) {
		tmp := &unstructured.Unstructured{}
		err := tmp.UnmarshalJSON(raw)
		if err == nil && tmp.GetKind() == "DeletedMarker" {
			return true
		}
	}
	return false
}

func (s *cdkBackend) PrepareList(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	resources, err := buildTree(ctx, s, req.Options.Key)
	if err != nil {
		return nil, err
	}

	rsp := &ListResponse{
		ResourceVersion: s.rv.Load(),
	}
	for _, item := range resources {
		latest := item.versions[0]
		raw, err := s.bucket.ReadAll(ctx, latest.key)
		if err != nil {
			return nil, err
		}
		if !isDeletedMarker(raw) {
			rsp.Items = append(rsp.Items, &ResourceWrapper{
				ResourceVersion: latest.rv,
				Value:           raw,
			})
		}
	}
	return rsp, nil
}

func (s *cdkBackend) WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.broadcaster == nil {
		var err error
		s.broadcaster, err = NewBroadcaster(context.Background(), func(c chan<- *WrittenEvent) error {
			s.stream = c
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	return s.broadcaster.Subscribe(ctx)
}

// group > resource > namespace > name > versions
type cdkResource struct {
	prefix   string
	versions []cdkVersion
}
type cdkVersion struct {
	rv  int64
	key string
}

func buildTree(ctx context.Context, s *cdkBackend, key *ResourceKey) ([]cdkResource, error) {
	byPrefix := make(map[string]*cdkResource)

	path := s.getPath(key, 0)
	iter := s.bucket.List(&blob.ListOptions{Prefix: path, Delimiter: ""}) // "" is recursive
	for {
		obj, err := iter.Next(ctx)
		if err == io.EOF {
			break
		}
		if strings.HasSuffix(obj.Key, ".json") {
			idx := strings.LastIndex(obj.Key, "/") + 1
			edx := strings.LastIndex(obj.Key, ".")
			if idx > 0 {
				rv, err := strconv.ParseInt(obj.Key[idx:edx], 10, 64)
				if err == nil {
					prefix := obj.Key[:idx]
					res, ok := byPrefix[prefix]
					if !ok {
						res = &cdkResource{prefix: prefix}
						byPrefix[prefix] = res
					}

					res.versions = append(res.versions, cdkVersion{
						rv:  rv,
						key: obj.Key,
					})
				}
			}
		}
	}

	// Now sort all versions
	resources := make([]cdkResource, 0, len(byPrefix))
	for _, res := range byPrefix {
		sort.Slice(res.versions, func(i, j int) bool {
			return res.versions[i].rv > res.versions[j].rv
		})
		resources = append(resources, *res)
	}
	sort.Slice(resources, func(i, j int) bool {
		a := resources[i].versions[0].rv
		b := resources[j].versions[0].rv
		return a > b
	})

	return resources, nil
}
