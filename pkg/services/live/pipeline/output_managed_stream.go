package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/live"
)

type ManagedStreamOutput struct {
	GrafanaLive *live.GrafanaLive
}

func NewManagedStreamOutput(gLive *live.GrafanaLive) *ManagedStreamOutput {
	return &ManagedStreamOutput{GrafanaLive: gLive}
}

func (l *ManagedStreamOutput) Output(_ context.Context, vars OutputVars, frame *data.Frame) error {
	stream, err := l.GrafanaLive.ManagedStreamRunner.GetOrCreateStream(vars.OrgID, vars.Namespace)
	if err != nil {
		logger.Error("Error getting stream", "error", err)
		return err
	}
	return stream.Push(vars.Path, frame)
}
