package main

import (
	"context"
	"io"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/fixfoldermetadata"
)

// runFix runs the same worker as the fix-folder-metadata job: every directory in
// the repository without a _folder.json gets one, in one commit for git repositories.
func runFix(ctx context.Context, opts options, out io.Writer) error {
	run, err := newJobRun(ctx, opts)
	if err != nil {
		return err
	}

	_, status, processErr := run.process(ctx, fixfoldermetadata.NewWorker(run.target.clients), provisioning.JobSpec{
		Action:            provisioning.JobActionFixFolderMetadata,
		Message:           opts.message,
		FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{Ref: opts.writeBranch},
	}, out, opts.jsonOutput)

	if err := printCommitResult(out, commandFix, status, opts.jsonOutput); err != nil {
		return err
	}
	return processErr
}
