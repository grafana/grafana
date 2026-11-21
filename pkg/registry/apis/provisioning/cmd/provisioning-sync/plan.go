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
	cfg, current, err := loadPlanInputs(ctx, opts)
	if err != nil {
		return err
	}
	if opts.fromRef != "" {
		cfg.Status.Sync.LastRef = opts.fromRef
	}

	repo, err := buildRepository(ctx, cfg, opts.token, opts.homePath)
	if err != nil {
		return fmt.Errorf("build repository: %w", err)
	}

	var result *planResult
	if opts.incremental {
		result, err = planIncremental(ctx, repo)
	} else {
		result, err = planFull(ctx, repo, current)
	}
	if err != nil {
		return err
	}
	return printPlan(out, result, opts.jsonOutput)
}

// loadPlanInputs returns the repository and what it manages today. A repository described by
// flags has no Grafana behind it, so it manages nothing yet.
func loadPlanInputs(ctx context.Context, opts options) (*provisioning.Repository, *provisioning.ResourceList, error) {
	if opts.repoName == "" {
		cfg, err := repositoryFromFlags(opts)
		return cfg, &provisioning.ResourceList{}, err
	}

	g, err := newGrafana(opts)
	if err != nil {
		return nil, nil, err
	}
	cfg, err := g.getRepository(ctx, opts.namespace, opts.repoName)
	if err != nil {
		return nil, nil, err
	}
	current, err := g.lister.List(ctx, opts.namespace, opts.repoName, resources.ListOptions{})
	if err != nil {
		return nil, nil, fmt.Errorf("list resources managed by %s: %w", opts.repoName, err)
	}
	return cfg, current, nil
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

	switch result.Mode {
	case "incremental":
		fmt.Fprintf(out, "incremental plan %s..%s: %d changes\n", result.FromRef, result.Ref, len(result.Changes))
	default:
		fmt.Fprintf(out, "full plan at %q: %d changes\n", result.Ref, len(result.Changes))
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
		fmt.Fprintln(out, line)
	}
	for _, p := range result.FoldersMissingMetadata {
		fmt.Fprintf(out, "  folder missing metadata: %s\n", p)
	}
	for _, msg := range result.InvalidFolderMetadata {
		fmt.Fprintf(out, "  %s\n", msg)
	}
	return nil
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
