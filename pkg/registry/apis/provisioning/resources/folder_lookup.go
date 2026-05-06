package resources

import (
	"context"
	"sync"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

// FolderUIDByPath resolves the UID of an existing managed folder at a given
// source path inside the repository. It exists to bridge the gap between the
// path-derived deterministic UID computed by ParseFolder and the real UID a
// folder may already have in unified storage (e.g. one created in the UI and
// later pushed to git without a _folder.json manifest).
//
// Implementations consult unified storage and return the UID stored there.
// They MUST NOT fall back to deterministic / hash-derived UIDs — the caller
// is responsible for that fallback so the resolution order at the call site
// stays explicit.
//
//go:generate mockery --name FolderUIDByPath --structname MockFolderUIDByPath --inpackage --filename folder_lookup_mock.go --with-expecter
type FolderUIDByPath interface {
	// LookupFolderUID returns the UID of the folder owned by the repository
	// at sourcePath. ok is false when no such folder exists in unified storage.
	LookupFolderUID(ctx context.Context, sourcePath string) (uid string, ok bool, err error)
}

// FolderUIDByPathFactory builds a per-repository FolderUIDByPath. The returned
// lookup is bound to a single (namespace, repository) pair and is expected to
// memoize unified-storage queries within its lifetime.
//
//go:generate mockery --name FolderUIDByPathFactory --structname MockFolderUIDByPathFactory --inpackage --filename folder_lookup_factory_mock.go --with-expecter
type FolderUIDByPathFactory interface {
	ForRepository(namespace, repoName string) FolderUIDByPath
}

// NewListerFolderUIDByPathFactory returns a FolderUIDByPathFactory backed by
// the provisioning resource lister. Each ForRepository call returns a lookup
// whose first LookupFolderUID invocation lists all managed objects for the
// repository and indexes folder source paths; subsequent calls hit the cached
// index.
func NewListerFolderUIDByPathFactory(lister ResourceLister) FolderUIDByPathFactory {
	return &listerFolderUIDByPathFactory{lister: lister}
}

type listerFolderUIDByPathFactory struct {
	lister ResourceLister
}

func (f *listerFolderUIDByPathFactory) ForRepository(namespace, repoName string) FolderUIDByPath {
	return &listerFolderUIDByPath{
		lister:    f.lister,
		namespace: namespace,
		repoName:  repoName,
	}
}

type listerFolderUIDByPath struct {
	lister    ResourceLister
	namespace string
	repoName  string

	once  sync.Once
	paths map[string]string
	err   error
}

func (l *listerFolderUIDByPath) LookupFolderUID(ctx context.Context, sourcePath string) (string, bool, error) {
	if sourcePath == "" {
		return "", false, nil
	}
	l.once.Do(func() {
		list, err := l.lister.List(ctx, l.namespace, l.repoName)
		if err != nil {
			l.err = err
			return
		}
		paths := make(map[string]string, len(list.Items))
		for _, item := range list.Items {
			if item.Group != folders.GROUP || item.Path == "" {
				continue
			}
			paths[safepath.EnsureTrailingSlash(item.Path)] = item.Name
		}
		l.paths = paths
	})
	if l.err != nil {
		return "", false, l.err
	}
	uid, ok := l.paths[safepath.EnsureTrailingSlash(sourcePath)]
	return uid, ok, nil
}
