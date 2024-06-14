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

type FileSystemOptions struct {
	// OTel tracer
	Tracer trace.Tracer

	// Root file system -- null will be in memory
	Root hackpadfs.FS
}

func NewFileSystemStore(opts FileSystemOptions) (AppendingStore, error) {
	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("fs")
	}

	var err error
	root := opts.Root
	if root == nil {
		root, err = mem.NewFS()
		if err != nil {
			return nil, err
		}
	}

	return &fsStore{tracer: opts.Tracer, root: root}, nil
}

type fsStore struct {
	tracer trace.Tracer
	root   hackpadfs.FS
}

type fsEvent struct {
	ResourceVersion int64           `json:"resourceVersion"`
	Message         string          `json:"message,omitempty"`
	Operation       string          `json:"operation,omitempty"`
	Value           json.RawMessage `json:"value,omitempty"`
	BlobPath        string          `json:"blob,omitempty"`
}

// The only write command
func (f *fsStore) WriteEvent(ctx context.Context, event *WriteEvent) (int64, error) {
	body := fsEvent{
		ResourceVersion: event.EventID,
		Message:         event.Message,
		Operation:       event.Operation.String(),
		Value:           event.Value,
		// Blob...
	}
	// For this case, we will treat them the same
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
	rv := req.ResourceVersion

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

// List implements AppendingStore.
func (f *fsStore) List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	panic("unimplemented")
}

// Watch implements AppendingStore.
func (f *fsStore) Watch(context.Context, *WatchRequest) (chan *WatchResponse, error) {
	panic("unimplemented")
}
