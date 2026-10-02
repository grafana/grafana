package jobs

import (
	"context"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/require"
)

func TestProgressDoesNotExceedHundredPercent(t *testing.T) {
	newRecorder := func() *jobProgressRecorder {
		return NewJobProgressRecorder(func(context.Context, provisioning.JobStatus) error { return nil }, nil, provisioning.JobActionPull).(*jobProgressRecorder)
	}
	ctx := context.Background()

	t.Run("a result recorded before SetTotal does not push progress past 100", func(t *testing.T) {
		r := newRecorder()
		r.Record(ctx, NewPathOnlyResult("a & b.json").WithAction(repository.FileActionIgnored).
			WithError(&resources.UnsupportedPathError{Paths: []resources.UnsupportedPath{{Path: "a & b.json", Err: resources.ErrUnsupportedFileExtension}}}).Build())
		r.SetTotal(ctx, 1)
		r.Record(ctx, NewPathOnlyResult("ok.json").WithAction(repository.FileActionCreated).Build())

		require.InDelta(t, 100.0, r.currentStatus().Progress, 0.001)
	})

	t.Run("progress is still the plain ratio below 100", func(t *testing.T) {
		r := newRecorder()
		r.SetTotal(ctx, 4)
		r.Record(ctx, NewPathOnlyResult("ok.json").WithAction(repository.FileActionCreated).Build())

		require.InDelta(t, 25.0, r.currentStatus().Progress, 0.001)
	})
}
