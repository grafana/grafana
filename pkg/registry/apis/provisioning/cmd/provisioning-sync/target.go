package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	jsonpatch "gopkg.in/evanphx/json-patch.v4"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// target is the repository a command works on, what it manages in Grafana, and where its sync
// status (including status.sync.lastRef) is kept.
type target struct {
	cfg *provisioning.Repository
	// grafana and lister are nil for an offline plan.
	grafana     *grafana
	lister      resources.ResourceLister
	patchStatus sync.RepositoryPatchFn
	// syncedRef reads status.sync.lastRef back after a pull.
	syncedRef func(ctx context.Context) (string, error)
}

// loadTarget reads a Repository from Grafana, whose status the pull patches like the real job,
// or describes one from flags, whose status lives in a local state file instead.
func loadTarget(ctx context.Context, opts options) (*target, error) {
	if opts.repoName != "" {
		return loadRepositoryTarget(ctx, opts)
	}

	cfg, err := repositoryFromFlags(opts)
	if err != nil {
		return nil, err
	}
	state := &stateFile{path: opts.stateFile}
	if opts.stateFile == "" {
		state.path = filepath.Join(".provisioning-sync", cfg.Namespace, cfg.Name+".json")
	}
	if err := state.load(cfg); err != nil {
		return nil, err
	}
	if opts.fromRef != "" {
		cfg.Status.Sync.LastRef = opts.fromRef
	}

	t := &target{
		cfg:         cfg,
		patchStatus: state.patch,
		syncedRef: func(context.Context) (string, error) {
			return cfg.Status.Sync.LastRef, nil
		},
	}
	if opts.offline {
		return t, nil
	}
	if t.grafana, err = newGrafana(opts); err != nil {
		return nil, err
	}
	t.lister = &managedResourceLister{clients: t.grafana.clients}
	return t, nil
}

func loadRepositoryTarget(ctx context.Context, opts options) (*target, error) {
	g, err := newGrafana(opts)
	if err != nil {
		return nil, err
	}
	cfg, err := g.getRepository(ctx, opts.namespace, opts.repoName)
	if err != nil {
		return nil, err
	}
	if opts.fromRef != "" {
		cfg.Status.Sync.LastRef = opts.fromRef
	}

	return &target{
		cfg:         cfg,
		grafana:     g,
		lister:      g.apiLister,
		patchStatus: appcontroller.NewRepositoryStatusPatcher(g.provisioning.ProvisioningV0alpha1()).Patch,
		syncedRef: func(ctx context.Context) (string, error) {
			updated, err := g.getRepository(ctx, opts.namespace, opts.repoName)
			if err != nil {
				return "", err
			}
			return updated.Status.Sync.LastRef, nil
		},
	}, nil
}

// stateFile keeps the status of a repository that does not exist in Grafana.
type stateFile struct {
	path string
}

func (s *stateFile) load(cfg *provisioning.Repository) error {
	data, err := os.ReadFile(s.path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read state file: %w", err)
	}
	if err := json.Unmarshal(data, &cfg.Status); err != nil {
		return fmt.Errorf("parse state file %s: %w", s.path, err)
	}
	return nil
}

// patch applies the JSON patch operations the sync worker sends to the Repository status
// subresource, then saves the result.
func (s *stateFile) patch(_ context.Context, repo *provisioning.Repository, operations ...map[string]interface{}) error {
	rawPatch, err := json.Marshal(operations)
	if err != nil {
		return fmt.Errorf("encode status patch: %w", err)
	}
	patch, err := jsonpatch.DecodePatch(rawPatch)
	if err != nil {
		return fmt.Errorf("decode status patch: %w", err)
	}
	doc, err := json.Marshal(repo)
	if err != nil {
		return fmt.Errorf("encode repository: %w", err)
	}
	patched, err := patch.Apply(doc)
	if err != nil {
		return fmt.Errorf("apply status patch: %w", err)
	}

	var updated provisioning.Repository
	if err := json.Unmarshal(patched, &updated); err != nil {
		return fmt.Errorf("decode patched repository: %w", err)
	}
	repo.Status = updated.Status

	data, err := json.MarshalIndent(repo.Status, "", "  ")
	if err != nil {
		return fmt.Errorf("encode state: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0o750); err != nil {
		return fmt.Errorf("create state directory: %w", err)
	}
	if err := os.WriteFile(s.path, data, 0o600); err != nil {
		return fmt.Errorf("write state file: %w", err)
	}
	return nil
}

// managedResourceLister finds what a repository manages by listing every supported kind and
// keeping the objects whose manager annotations name it. Grafana can only answer that through a
// Repository resource, which a repository described by flags does not have.
type managedResourceLister struct {
	clients resources.ClientFactory
}

func (l *managedResourceLister) List(ctx context.Context, namespace, repository string, _ resources.ListOptions) (*provisioning.ResourceList, error) {
	clients, err := l.clients.Clients(ctx, namespace)
	if err != nil {
		return nil, fmt.Errorf("get clients: %w", err)
	}

	list := &provisioning.ResourceList{}
	for _, supported := range clients.SupportedResources() {
		client, gvr, err := clients.ForKind(ctx, supported.WithVersion(""))
		if err != nil {
			return nil, fmt.Errorf("get client for %s: %w", supported.GroupKind, err)
		}
		err = resources.ForEach(ctx, client, func(obj *unstructured.Unstructured) error {
			meta, err := utils.MetaAccessor(obj)
			if err != nil {
				return err
			}
			manager, ok := meta.GetManagerProperties()
			if !ok || manager.Kind != utils.ManagerKindRepo || manager.Identity != repository {
				return nil
			}
			source, _ := meta.GetSourceProperties()
			list.Items = append(list.Items, provisioning.ResourceListItem{
				Path:     source.Path,
				Group:    gvr.Group,
				Resource: gvr.Resource,
				Name:     obj.GetName(),
				Hash:     source.Checksum,
				Time:     source.TimestampMillis,
				Title:    meta.FindTitle(""),
				Folder:   meta.GetFolder(),
			})
			return nil
		})
		if err != nil {
			return nil, fmt.Errorf("list %s: %w", gvr, err)
		}
	}
	return list, nil
}

func (l *managedResourceLister) RepositoryStats(ctx context.Context, namespace, repository string) ([]provisioning.ResourceCount, error) {
	list, err := l.List(ctx, namespace, repository, resources.ListOptions{})
	if err != nil {
		return nil, err
	}

	var counts []provisioning.ResourceCount
	index := map[string]int{}
	for _, item := range list.Items {
		key := item.Group + "/" + item.Resource
		i, ok := index[key]
		if !ok {
			i = len(counts)
			index[key] = i
			counts = append(counts, provisioning.ResourceCount{Group: item.Group, Resource: item.Resource})
		}
		counts[i].Count++
	}
	return counts, nil
}
