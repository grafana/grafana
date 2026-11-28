package main

import (
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/features"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestEnableExportPassesTheExportWorkerFlagCheck(t *testing.T) {
	require.NoError(t, enableExport())

	// The same evaluation the export worker makes before it exports anything.
	evalCtx := features.EvaluationContextFromTargetingKey("default")
	require.True(t, openfeature.NewDefaultClient().Boolean(t.Context(), featuremgmt.FlagProvisioningExport, false, evalCtx))
}
