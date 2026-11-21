package main

import (
	"context"
	"fmt"
	"io"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/export"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// runPush runs the same export worker the job driver runs: unmanaged folders and resources are
// read from Grafana and written to the repository, as one commit for git repositories.
func runPush(ctx context.Context, opts options, out io.Writer) error {
	if err := enableExport(); err != nil {
		return err
	}
	run, err := newJobRun(ctx, opts)
	if err != nil {
		return err
	}

	// The standalone export job writes new names so the files don't collide with the exported
	// originals on the next pull; the migration export keeps them so a pull can take them over.
	exportFn := export.ExportAllWithNewUIDs
	if opts.keepUIDs {
		exportFn = export.ExportAll
	}
	worker := export.NewExportWorker(run.target.clients, run.repositoryResources, exportFn, repository.WrapWithStageAndPushIfPossible, run.metrics)

	_, status, processErr := run.process(ctx, worker, provisioning.JobSpec{
		Action:  provisioning.JobActionPush,
		Message: opts.message,
		Push:    &provisioning.ExportJobOptions{Branch: opts.pushBranch, Path: opts.pushPath, GenerateNewFolderIDs: opts.newFolders},
	}, out, opts.jsonOutput)

	if err := printPushResult(out, status, opts.jsonOutput); err != nil {
		return err
	}
	return processErr
}

// enableExport turns on the feature flag the export worker checks. Running push is the opt-in;
// the flag gates the feature for Grafana instances, which the CLI does not read flags from.
func enableExport() error {
	provider := memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagProvisioningExport: {
			Key:            featuremgmt.FlagProvisioningExport,
			State:          memprovider.Enabled,
			DefaultVariant: "on",
			Variants:       map[string]any{"on": true},
		},
	})
	if err := openfeature.SetProviderAndWait(provider); err != nil {
		return fmt.Errorf("enable export: %w", err)
	}
	return nil
}

func printPushResult(out io.Writer, status provisioning.JobStatus, asJSON bool) error {
	if asJSON {
		return printJSON(out, status)
	}

	w := &errWriter{w: out}
	w.printf("push finished: state=%s message=%q\n", status.State, status.Message)
	if status.URLs != nil {
		if status.URLs.SourceURL != "" {
			w.printf("  branch: %s\n", status.URLs.SourceURL)
		}
		if status.URLs.NewPullRequestURL != "" {
			w.printf("  new pull request: %s\n", status.URLs.NewPullRequestURL)
		}
	}
	printStatusDetails(w, status)
	return w.err
}
