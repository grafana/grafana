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
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// target is the repository a command works on, what it manages in Grafana, and the state file
// that keeps its sync status, including status.sync.lastRef, between runs.
type target struct {
	cfg   *provisioning.Repository
	state *stateFile
	// clients and lister are nil for an offline plan.
	clients resources.ClientFactory
	lister  resources.ResourceLister
}

func loadTarget(opts options) (*target, error) {
	cfg, err := repositoryFromFlags(opts)
	if err != nil {
		return nil, err
	}
	state := &stateFile{path: opts.stateFile}
	if state.path == "" {
		dir, err := os.UserConfigDir()
		if err != nil {
			return nil, fmt.Errorf("find a directory for the state file, or set --state-file: %w", err)
		}
		state.path = filepath.Join(dir, "grafana-provisioning-sync", cfg.Namespace, cfg.Name+".json")
	}
	if err := state.load(cfg); err != nil {
		return nil, err
	}
	if opts.fromRef != "" {
		cfg.Status.Sync.LastRef = opts.fromRef
	}

	t := &target{cfg: cfg, state: state}
	if opts.offline {
		return t, nil
	}
	if t.clients, err = newClientFactory(opts); err != nil {
		return nil, err
	}
	t.lister = &managedResourceLister{clients: t.clients}
	return t, nil
}

// stateFile stands in for the status subresource of a Repository that does not exist in Grafana.
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
