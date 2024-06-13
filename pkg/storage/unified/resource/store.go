package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"github.com/hack-pad/hackpadfs"
	"github.com/hack-pad/hackpadfs/mem"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type FileSystemStoreOptions struct {
	// OTel tracer
	Tracer trace.Tracer

	// Get the next EventID.  When not set, this will default to snowflake IDs
	NextEventID func() int64

	// Root file system -- null will be in memory
	Root hackpadfs.FS
}

func NewFSStore(opts FileSystemStoreOptions) (ResourceStoreServer, error) {
	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("testing")
	}

	var err error
	root := opts.Root
	if root == nil {
		root, err = mem.NewFS()
		if err != nil {
			return nil, err
		}
	}

	store := &fsStore{root: root}
	store.writer, err = NewResourceWriter(WriterOptions{
		Tracer:   opts.Tracer,
		Reader:   store.Read,
		Appender: store.append,
	})

	return store, err
}

var _ ResourceStoreServer = &fsStore{}

type fsStore struct {
	writer ResourceWriter

	root hackpadfs.FS
}

type fsEvent struct {
	ResourceVersion int64           `json:"resourceVersion"`
	Message         string          `json:"message,omitempty"`
	Operation       string          `json:"operation,omitempty"`
	Value           json.RawMessage `json:"value,omitempty"`
	BlobPath        string          `json:"blob,omitempty"`
}

// The only write command
func (f *fsStore) append(ctx context.Context, event *WriteEvent) (int64, error) {
	body := fsEvent{
		ResourceVersion: event.EventID,
		Message:         event.Message,
		Operation:       event.Operation.String(),
		Value:           event.Value,
		// Blob...
	}
	// For this case, we will treat them the same
	event.Key.ResourceVersion = 0
	dir := event.Key.NamespacedPath()
	err := hackpadfs.MkdirAll(f.root, dir, 0750)
	if err != nil {
		return 0, err
	}

	bytes, err := json.Marshal(&body)
	if err != nil {
		return 0, err
	}

	fpath := filepath.Join(dir, fmt.Sprintf("%d.json", event.EventID))
	file, err := hackpadfs.OpenFile(f.root, fpath, hackpadfs.FlagWriteOnly|hackpadfs.FlagCreate, 0750)
	if err != nil {
		return 0, err
	}
	_, err = hackpadfs.WriteFile(file, bytes)
	return event.EventID, err
}

// Read implements ResourceStoreServer.
func (f *fsStore) Read(ctx context.Context, req *ReadRequest) (*ReadResponse, error) {
	rv := req.Key.ResourceVersion
	req.Key.ResourceVersion = 0

	fname := "--x--"
	dir := req.Key.NamespacedPath()
	if rv > 0 {
		fname = fmt.Sprintf("%d.json", rv)
	} else {
		files, err := hackpadfs.ReadDir(f.root, dir)
		if err != nil {
			return nil, err
		}

		// Sort by name
		sort.Slice(files, func(i, j int) bool {
			a := files[i].Name()
			b := files[j].Name()
			return a > b // ?? should we parse the numbers ???
		})

		// The first matching file
		for _, v := range files {
			fname = v.Name()
			if strings.HasSuffix(fname, ".json") {
				break
			}
		}
	}

	evt, err := f.open(filepath.Join(dir, fname))
	if err != nil || evt.Operation == ResourceOperation_DELETED.String() {
		return nil, apierrors.NewNotFound(schema.GroupResource{
			Group:    req.Key.Group,
			Resource: req.Key.Resource,
		}, req.Key.Name)
	}

	return &ReadResponse{
		ResourceVersion: evt.ResourceVersion,
		Value:           evt.Value,
		Message:         evt.Message,
	}, nil
}

func (f *fsStore) open(p string) (*fsEvent, error) {
	raw, err := hackpadfs.ReadFile(f.root, p)
	if err != nil {
		return nil, err
	}

	evt := &fsEvent{}
	err = json.Unmarshal(raw, evt)
	return evt, err
}

func (f *fsStore) Create(ctx context.Context, req *CreateRequest) (*CreateResponse, error) {
	return f.writer.Create(ctx, req)
}

// Update implements ResourceStoreServer.
func (f *fsStore) Update(ctx context.Context, req *UpdateRequest) (*UpdateResponse, error) {
	return f.writer.Update(ctx, req)
}

// Delete implements ResourceStoreServer.
func (f *fsStore) Delete(ctx context.Context, req *DeleteRequest) (*DeleteResponse, error) {
	return f.writer.Delete(ctx, req)
}

// IsHealthy implements ResourceStoreServer.
func (f *fsStore) IsHealthy(context.Context, *HealthCheckRequest) (*HealthCheckResponse, error) {
	return &HealthCheckResponse{Status: HealthCheckResponse_SERVING}, nil
}

// List implements ResourceStoreServer.
func (f *fsStore) List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	panic("unimplemented")
}

// Watch implements ResourceStoreServer.
func (f *fsStore) Watch(*WatchRequest, ResourceStore_WatchServer) error {
	panic("unimplemented")
}
