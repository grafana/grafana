package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type planResult struct {
	Mode                   string       `json:"mode"`
	FromRef                string       `json:"fromRef,omitempty"`
	Ref                    string       `json:"ref,omitempty"`
	Changes                []planChange `json:"changes"`
	FoldersMissingMetadata []string     `json:"foldersMissingMetadata,omitempty"`
	InvalidFolderMetadata  []string     `json:"invalidFolderMetadata,omitempty"`
}

type planChange struct {
	Action       repository.FileAction `json:"action"`
	Path         string                `json:"path"`
	PreviousPath string                `json:"previousPath,omitempty"`
	Existing     string                `json:"existing,omitempty"`
	Reason       string                `json:"reason,omitempty"`
	Warning      string                `json:"warning,omitempty"`
}

func runPlan(ctx context.Context, opts options, out io.Writer) error {
	t, err := loadTarget(ctx, opts)
	if err != nil {
		return err
	}
	repo, err := buildRepository(ctx, t.cfg, opts.token, opts.homePath)
	if err != nil {
		return fmt.Errorf("build repository: %w", err)
	}

	var result *planResult
	if opts.incremental {
		result, err = planIncremental(ctx, repo)
	} else {
		result, err = planFullForTarget(ctx, repo, t)
	}
	if err != nil {
		return err
	}
	return printPlan(out, result, opts.jsonOutput)
}

// planFullForTarget compares the repository with what it manages in Grafana; offline, with an
// empty instance.
func planFullForTarget(ctx context.Context, repo repository.Repository, t *target) (*planResult, error) {
	current := &provisioning.ResourceList{}
	if t.lister != nil {
		var err error
		current, err = t.lister.List(ctx, t.cfg.Namespace, t.cfg.Name, resources.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("list resources managed by %s: %w", t.cfg.Name, err)
		}
	}
	return planFull(ctx, repo, current)
}

func planFull(ctx context.Context, repo repository.Repository, current *provisioning.ResourceList) (*planResult, error) {
	reader, ok := repo.(repository.Reader)
	if !ok {
		return nil, errors.New("repository cannot be read")
	}

	result := &planResult{Mode: "full"}
	if versioned, ok := repo.(repository.Versioned); ok {
		ref, err := versioned.LatestRef(ctx)
		if err != nil {
			return nil, fmt.Errorf("get latest ref: %w", err)
		}
		result.Ref = ref
	}

	changes, missingMetadata, invalidMetadata, err := sync.Compare(ctx, reader, &plannedResources{current: current}, result.Ref)
	if err != nil {
		return nil, fmt.Errorf("compare repository with Grafana: %w", err)
	}

	result.Changes = make([]planChange, 0, len(changes))
	for _, change := range changes {
		pc := planChange{Action: change.Action, Path: change.Path, Reason: change.Reason}
		if change.Existing != nil {
			pc.Existing = fmt.Sprintf("%s/%s/%s", change.Existing.Group, change.Existing.Resource, change.Existing.Name)
		}
		if change.Warning != nil {
			pc.Warning = change.Warning.Error()
		}
		result.Changes = append(result.Changes, pc)
	}
	result.FoldersMissingMetadata = missingMetadata
	for _, invalid := range invalidMetadata {
		result.InvalidFolderMetadata = append(result.InvalidFolderMetadata, invalid.Error())
	}
	return result, nil
}

func planIncremental(ctx context.Context, repo repository.Repository) (*planResult, error) {
	versioned, ok := repo.(repository.Versioned)
	if !ok {
		return nil, fmt.Errorf("%s repositories are not versioned and only support full pulls", repo.Config().Spec.Type)
	}
	fromRef := repo.Config().Status.Sync.LastRef
	if fromRef == "" {
		return nil, errors.New("no last synced commit to diff from; set --from-ref or run a full pull first")
	}

	ref, err := versioned.LatestRef(ctx)
	if err != nil {
		return nil, fmt.Errorf("get latest ref: %w", err)
	}

	result := &planResult{Mode: "incremental", FromRef: fromRef, Ref: ref, Changes: []planChange{}}
	if ref == fromRef {
		return result, nil
	}

	changes, err := versioned.CompareFiles(ctx, fromRef, ref)
	if err != nil {
		return nil, fmt.Errorf("compare %s..%s: %w", fromRef, ref, err)
	}
	for _, change := range changes {
		result.Changes = append(result.Changes, planChange{Action: change.Action, Path: change.Path, PreviousPath: change.PreviousPath})
	}
	return result, nil
}

func printPlan(out io.Writer, result *planResult, asJSON bool) error {
	if asJSON {
		enc := json.NewEncoder(out)
		enc.SetIndent("", "  ")
		return enc.Encode(result)
	}

	w := &errWriter{w: out}
	switch result.Mode {
	case "incremental":
		w.printf("incremental plan %s..%s: %d changes\n", result.FromRef, result.Ref, len(result.Changes))
	default:
		w.printf("full plan at %q: %d changes\n", result.Ref, len(result.Changes))
	}
	for _, c := range result.Changes {
		line := fmt.Sprintf("  %-8s %s", c.Action, c.Path)
		if c.PreviousPath != "" {
			line += " (from " + c.PreviousPath + ")"
		}
		if c.Existing != "" {
			line += " [" + c.Existing + "]"
		}
		if c.Reason != "" {
			line += " reason=" + c.Reason
		}
		if c.Warning != "" {
			line += " warning=" + c.Warning
		}
		w.printf("%s\n", line)
	}
	for _, p := range result.FoldersMissingMetadata {
		w.printf("  folder missing metadata: %s\n", p)
	}
	for _, msg := range result.InvalidFolderMetadata {
		w.printf("  %s\n", msg)
	}
	return w.err
}

// plannedResources serves sync.Compare the resources Grafana manages today. Compare only calls
// List and SetTree; any other method panics on the nil embedded interface, which keeps the plan
// from writing anything.
type plannedResources struct {
	resources.RepositoryResources
	current *provisioning.ResourceList
}

func (p *plannedResources) List(context.Context) (*provisioning.ResourceList, error) {
	return p.current, nil
}

func (p *plannedResources) SetTree(resources.FolderTree) {}
