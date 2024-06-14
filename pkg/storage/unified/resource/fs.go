package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"path/filepath"
	"sort"
	"strconv"
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

	return &fsStore{
		tracer: opts.Tracer,
		root:   root,
		keys:   &simpleConverter{}, // not tenant isolated
	}, nil
}

type fsStore struct {
	tracer trace.Tracer
	root   hackpadfs.FS
	keys   KeyConversions
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
	dir, err := f.keys.KeyToPath(event.Key, 0)
	if err != nil {
		return 0, err
	}
	err = hackpadfs.MkdirAll(f.root, dir, 0750)
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
	dir, err := f.keys.KeyToPath(req.Key, 0)
	if err != nil {
		return nil, err
	}
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

type eventTree struct {
	path       string
	group      string
	resource   string
	namespaces []namespaceEvents
}

func (t *eventTree) list(fs *fsStore, rv int64) (*ListResponse, error) {
	rsp := &ListResponse{}
	for idx, ns := range t.namespaces {
		if idx == 0 {
			rsp.ResourceVersion = ns.version()
		}
		err := ns.append(fs, rv, rsp)
		if err != nil {
			return rsp, err
		}
	}
	return rsp, nil
}

func (t *eventTree) read(root fs.FS, key *ResourceKey) error {
	t.group = key.Group
	t.resource = key.Resource
	t.path = fmt.Sprintf("%s/%s", t.group, t.resource)

	// Cluster scoped, with an explicit name
	if key.Namespace == "" {
		if key.Name != "" {
			ns := namespaceEvents{
				path:      t.path + "/__cluster__",
				namespace: "",
			}
			err := ns.read(root, key)
			if err == nil {
				t.namespaces = append(t.namespaces, ns)
			}
			return err
		}
	}

	files, err := hackpadfs.ReadDir(root, t.path)
	if err != nil {
		return err
	}
	for _, file := range files {
		ns := namespaceEvents{
			path:      t.path + "/" + file.Name(),
			namespace: file.Name(),
		}
		err = ns.read(root, key)
		if err != nil {
			return err
		}
		t.namespaces = append(t.namespaces, ns)
	}

	return nil
}

type namespaceEvents struct {
	path      string
	namespace string
	names     []nameEvents
}

func (t *namespaceEvents) version() int64 {
	if len(t.names) > 0 {
		return t.names[0].version()
	}
	return 0
}

func (t *namespaceEvents) append(fs *fsStore, rv int64, rsp *ListResponse) error {
	for _, name := range t.names {
		err := name.append(fs, rv, rsp)
		if err != nil {
			return err
		}
	}
	return nil
}

func (t *namespaceEvents) read(root fs.FS, key *ResourceKey) error {
	if key.Name != "" {
		vv := nameEvents{
			path: t.path + "/" + key.Name,
			name: key.Name,
		}
		err := vv.read(root)
		if err != nil {
			return err
		}
		t.names = []nameEvents{vv}
	}

	files, err := hackpadfs.ReadDir(root, t.path)
	if err != nil {
		return err
	}
	for _, file := range files {
		ns := nameEvents{
			path: t.path + "/" + file.Name(),
			name: file.Name(),
		}
		err = ns.read(root)
		if err != nil {
			return err
		}
		t.names = append(t.names, ns)
	}
	return nil
}

type nameEvents struct {
	path     string
	name     string
	versions []resourceEvent
}

func (t *nameEvents) version() int64 {
	if len(t.versions) > 0 {
		return t.versions[0].rv
	}
	return 0
}

func (t *nameEvents) append(fs *fsStore, rv int64, rsp *ListResponse) error {
	for _, rev := range t.versions {
		val, err := fs.open(t.path + "/" + rev.file)
		if err != nil {
			return err
		}
		wrapper := &ResourceWrapper{
			ResourceVersion: val.ResourceVersion,
			Value:           val.Value,
			//			Operation:       val.Operation,
		}
		rsp.Items = append(rsp.Items, wrapper)
		if true {
			return nil
		}
	}
	return nil
}

func (t *nameEvents) read(root fs.FS) error {
	var err error
	files, err := hackpadfs.ReadDir(root, t.path)
	if err != nil {
		return err
	}
	for _, file := range files {
		p := file.Name()
		if file.IsDir() || !strings.HasSuffix(p, ".json") {
			continue
		}

		base := strings.TrimSuffix(p, ".json")
		base = strings.TrimPrefix(base, "rv")
		rr := resourceEvent{file: p}
		rr.rv, err = strconv.ParseInt(base, 10, 64)
		if err != nil {
			return err
		}
		t.versions = append(t.versions, rr)
	}
	sort.Slice(t.versions, func(i int, j int) bool {
		return t.versions[i].rv > t.versions[j].rv
	})
	return err
}

type resourceEvent struct {
	file string // path to the actual file
	rv   int64
}

// List implements AppendingStore.
func (f *fsStore) List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	tree := eventTree{
		group:    req.Options.Key.Group,
		resource: req.Options.Key.Resource,
	}
	err := tree.read(f.root, req.Options.Key)
	if err != nil {
		return nil, err
	}
	return tree.list(f, req.ResourceVersion)
}

// Watch implements AppendingStore.
func (f *fsStore) Watch(context.Context, *WatchRequest) (chan *WatchEvent, error) {
	panic("unimplemented")
}
