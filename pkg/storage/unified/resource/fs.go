package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/hack-pad/hackpadfs"
	"github.com/hack-pad/hackpadfs/mem"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type FileSystemOptions struct {
	// OTel tracer
	Tracer trace.Tracer

	// Root file system -- null will be in memory
	Root hackpadfs.FS
}

func NewFileSystemStore(opts FileSystemOptions) AppendingStore {
	root := opts.Root
	if root == nil {
		root, _ = mem.NewFS()
	}

	return &fsStore{
		root: root,
		keys: &simpleConverter{}, // not tenant isolated
	}
}

type fsStore struct {
	root hackpadfs.FS
	keys KeyConversions
}

// The only write command
func (f *fsStore) WriteEvent(ctx context.Context, event WriteEvent) (int64, error) {
	// For this case, we will treat them the same
	dir, err := f.keys.KeyToPath(event.Key, 0)
	if err != nil {
		return 0, err
	}
	err = hackpadfs.MkdirAll(f.root, dir, 0750)
	if err != nil {
		return 0, err
	}

	fpath := filepath.Join(dir, fmt.Sprintf("%d.json", event.EventID))
	file, err := hackpadfs.OpenFile(f.root, fpath, hackpadfs.FlagWriteOnly|hackpadfs.FlagCreate, 0750)
	if err != nil {
		return 0, err
	}
	_, err = hackpadfs.WriteFile(file, event.Value)
	return event.EventID, err
}

// Create new name for a given resource
func (f *fsStore) GenerateName(ctx context.Context, key *ResourceKey, prefix string) (string, error) {
	// TODO... shorter and make sure it does not exist
	return prefix + "x" + uuid.New().String(), nil
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
				// The RV is encoded in the path
				rv, err = strconv.ParseInt(strings.TrimSuffix(fname, ".json"), 10, 64)
				if err != nil {
					return nil, err
				}

				break
			}
		}
	}

	raw, err := hackpadfs.ReadFile(f.root, filepath.Join(dir, fname))
	if err != nil {
		return nil, err
	}
	if req.ResourceVersion < 1 {
		// The operation is inside the body, so need to inspect :(
		tmp := &metav1.PartialObjectMetadata{}
		err = json.Unmarshal(raw, tmp)
		if err != nil {
			return nil, err
		}
		meta, err := utils.MetaAccessor(tmp)
		if err != nil {
			return nil, err
		}
		if meta.GetGroupVersionKind().Kind == "DeletedMarker" {
			return nil, apierrors.NewNotFound(schema.GroupResource{
				Group:    req.Key.Group,
				Resource: req.Key.Resource,
			}, req.Key.Name)
		}
	}

	return &ReadResponse{
		ResourceVersion: rv,
		Value:           raw,
	}, nil
}

// List implements AppendingStore.
func (f *fsStore) List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	tree := eventTree{
		group:    req.Options.Key.Group,
		resource: req.Options.Key.Resource,
	}
	_ = tree.read(f.root, req.Options.Key)
	// if err != nil  {
	// 	return nil, err
	// }
	return tree.list(f, req.ResourceVersion)
}

// Watch implements AppendingStore.
func (f *fsStore) Watch(context.Context, *WatchRequest) (chan *WatchEvent, error) {
	panic("unimplemented")
}
