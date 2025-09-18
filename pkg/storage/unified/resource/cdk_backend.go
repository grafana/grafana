package resource

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"iter"
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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type CDKBackendOptions struct {
	Tracer     trace.Tracer
	Bucket     CDKBucket
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
	bucket CDKBucket
	root   string

	mutex sync.Mutex
	rv    atomic.Int64

	// Simple watch stream -- NOTE, this only works for single tenant!
	broadcaster Broadcaster[*WrittenEvent]
	stream      chan<- *WrittenEvent
}

func (s *cdkBackend) ListModifiedSince(ctx context.Context, key NamespacedResource, sinceRv int64) (int64, iter.Seq2[*ModifiedResource, error]) {
	return 0, func(yield func(*ModifiedResource, error) bool) {
		yield(nil, errors.New("not implemented"))
	}
}

func (s *cdkBackend) getPath(key *resourcepb.ResourceKey, rv int64) string {
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

// GetResourceStats implements Backend.
func (s *cdkBackend) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]ResourceStats, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *cdkBackend) WriteEvent(ctx context.Context, event WriteEvent) (rv int64, err error) {
	if event.Type == resourcepb.WatchEvent_ADDED {
		// ReadResource deals with deleted values (i.e. a file exists but has generation -999).
		resp := s.ReadResource(ctx, &resourcepb.ReadRequest{Key: event.Key})
		if resp.Error != nil && resp.Error.Code != http.StatusNotFound {
			return 0, GetError(resp.Error)
		}
		if resp.Value != nil {
			return 0, ErrResourceAlreadyExists
		}
	}

	// Scope the lock
	{
		s.mutex.Lock()
		defer s.mutex.Unlock()

		rv = s.rv.Add(1)
		err = s.bucket.WriteAll(ctx, s.getPath(event.Key, rv), event.Value, &blob.WriterOptions{
			ContentType: "application/json",
		})
	}

	// notify all subscribers
	if s.stream != nil {
		write := &WrittenEvent{
			Type:            event.Type,
			Key:             event.Key,
			PreviousRV:      event.PreviousRV,
			Value:           event.Value,
			Timestamp:       time.Now().UnixMilli(),
			ResourceVersion: rv,
		}
		s.stream <- write
	}
	return rv, err
}

func (s *cdkBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	rv := req.ResourceVersion

	path := s.getPath(req.Key, rv)
	if rv < 1 {
		iter := s.bucket.List(&blob.ListOptions{Prefix: path + "/", Delimiter: "/"})
		for {
			obj, err := iter.Next(ctx)
			if errors.Is(err, io.EOF) {
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
			return &BackendReadResponse{
				Error: &resourcepb.ErrorResult{
					Code:    http.StatusGatewayTimeout,
					Reason:  string(metav1.StatusReasonTimeout), // match etcd behavior
					Message: "ResourceVersion is larger than max",
					Details: &resourcepb.ErrorDetails{
						Causes: []*resourcepb.ErrorCause{
							{
								Reason:  string(metav1.CauseTypeResourceVersionTooLarge),
								Message: fmt.Sprintf("requested: %d, current %d", req.ResourceVersion, s.rv.Load()),
							},
						},
					},
				},
			}
		}

		// If the there was an explicit request, get the latest
		rsp := s.ReadResource(ctx, &resourcepb.ReadRequest{Key: req.Key})
		if rsp != nil && len(rsp.Value) > 0 {
			raw = rsp.Value
			rv = rsp.ResourceVersion
			err = nil
		}
	}
	if err == nil && isDeletedValue(raw) {
		raw = nil
	}
	if raw == nil {
		return &BackendReadResponse{Error: NewNotFoundError(req.Key)}
	}
	return &BackendReadResponse{
		Key:             req.Key,
		Folder:          "", // TODO: implement this
		ResourceVersion: rv,
		Value:           raw,
	}
}

func isDeletedValue(raw []byte) bool {
	if bytes.Contains(raw, []byte(`"generation":-999`)) {
		tmp := &unstructured.Unstructured{}
		err := tmp.UnmarshalJSON(raw)
		if err == nil && tmp.GetGeneration() == utils.DeletedGeneration {
			return true
		}
	}
	return false
}

func (s *cdkBackend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, cb func(ListIterator) error) (int64, error) {
	resources, err := buildTree(ctx, s, req.Options.Key)
	if err != nil {
		return 0, err
	}
	err = cb(resources)
	return resources.listRV, err
}

func (s *cdkBackend) ListHistory(ctx context.Context, req *resourcepb.ListRequest, cb func(ListIterator) error) (int64, error) {
	return 0, fmt.Errorf("listing from history not supported in CDK backend")
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

type cdkListIterator struct {
	bucket CDKBucket
	ctx    context.Context
	err    error

	listRV    int64
	resources []cdkResource
	index     int

	currentRV  int64
	currentKey string
	currentVal []byte
}

// Next implements ListIterator.
func (c *cdkListIterator) Next() bool {
	if c.err != nil {
		return false
	}
	for {
		c.currentVal = nil
		c.index += 1
		if c.index >= len(c.resources) {
			return false
		}

		item := c.resources[c.index]
		latest := item.versions[0]
		raw, err := c.bucket.ReadAll(c.ctx, latest.key)
		if err != nil {
			c.err = err
			return false
		}
		if !isDeletedValue(raw) {
			c.currentRV = latest.rv
			c.currentKey = latest.key
			c.currentVal = raw
			return true
		}
	}
}

// Error implements ListIterator.
func (c *cdkListIterator) Error() error {
	return c.err
}

// ResourceVersion implements ListIterator.
func (c *cdkListIterator) ResourceVersion() int64 {
	return c.currentRV
}

// Value implements ListIterator.
func (c *cdkListIterator) Value() []byte {
	return c.currentVal
}

// ContinueToken implements ListIterator.
func (c *cdkListIterator) ContinueToken() string {
	return fmt.Sprintf("index:%d/key:%s", c.index, c.currentKey)
}

// Name implements ListIterator.
func (c *cdkListIterator) Name() string {
	return c.currentKey // TODO (parse name from key)
}

// Namespace implements ListIterator.
func (c *cdkListIterator) Namespace() string {
	return c.currentKey // TODO (parse namespace from key)
}

func (c *cdkListIterator) Folder() string {
	return "" // TODO: implement this
}

var _ ListIterator = (*cdkListIterator)(nil)

func buildTree(ctx context.Context, s *cdkBackend, key *resourcepb.ResourceKey) (*cdkListIterator, error) {
	byPrefix := make(map[string]*cdkResource)
	path := s.getPath(key, 0)
	iter := s.bucket.List(&blob.ListOptions{Prefix: path, Delimiter: ""}) // "" is recursive
	for {
		obj, err := iter.Next(ctx)
		if errors.Is(err, io.EOF) {
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
		a := resources[i].prefix
		b := resources[j].prefix
		return a < b
	})

	return &cdkListIterator{
		ctx:       ctx,
		bucket:    s.bucket,
		resources: resources,
		listRV:    s.rv.Load(),
		index:     -1, // must call next first
	}, nil
}
