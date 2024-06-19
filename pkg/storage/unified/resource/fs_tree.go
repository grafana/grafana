package resource

import (
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"

	"github.com/hack-pad/hackpadfs"
)

// VERY VERY early, hacky file system reader
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
	if rv > 0 {
		fmt.Printf("TODO... check explicit rv")
	}

	for _, rev := range t.versions {
		raw, err := hackpadfs.ReadFile(fs.root, t.path+"/"+rev.file)
		if err != nil {
			return err
		}

		wrapper := &ResourceWrapper{
			ResourceVersion: rev.rv,
			Value:           raw,
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
