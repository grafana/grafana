package dualwrite

import (
	"context"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
	unifiedmigrations "github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
)

// versionedStatusReader is a configurable MigrationStatusReader for validation tests.
type versionedStatusReader struct {
	mode          unifiedmigrations.StorageMode
	targetVersion string
	hasTarget     bool
}

func (r *versionedStatusReader) GetStorageMode(_ context.Context, _ schema.GroupResource) (unifiedmigrations.StorageMode, error) {
	return r.mode, nil
}

func (r *versionedStatusReader) GetTargetVersion(_ schema.GroupResource) (string, bool) {
	return r.targetVersion, r.hasTarget
}

func TestValidateServedVersions(t *testing.T) {
	gr := schema.GroupResource{Group: "preferences.grafana.app", Resource: "preferences"}
	v1 := []schema.GroupVersion{{Group: gr.Group, Version: "v1"}}
	onlyV1alpha1 := []schema.GroupVersion{{Group: gr.Group, Version: "v1alpha1"}}

	newSvc := func(r unifiedmigrations.MigrationStatusReader) *storageService {
		return &storageService{
			statusReader: r,
			metrics:      provideDualWriterMetrics(prometheus.NewRegistry()),
		}
	}

	t.Run("legacy mode never validates", func(t *testing.T) {
		svc := newSvc(&versionedStatusReader{mode: unifiedmigrations.StorageModeLegacy, targetVersion: "v1", hasTarget: true})
		require.NoError(t, svc.ValidateServedVersions(context.Background(), gr, onlyV1alpha1))
	})

	t.Run("target version served in unified mode", func(t *testing.T) {
		svc := newSvc(&versionedStatusReader{mode: unifiedmigrations.StorageModeUnified, targetVersion: "v1", hasTarget: true})
		require.NoError(t, svc.ValidateServedVersions(context.Background(), gr, v1))
	})

	t.Run("target version not served in unified mode returns error", func(t *testing.T) {
		svc := newSvc(&versionedStatusReader{mode: unifiedmigrations.StorageModeUnified, targetVersion: "v1", hasTarget: true})
		err := svc.ValidateServedVersions(context.Background(), gr, onlyV1alpha1)
		require.Error(t, err)
		require.Contains(t, err.Error(), "v1")
	})

	t.Run("target version not served in dual-write mode also returns error", func(t *testing.T) {
		svc := newSvc(&versionedStatusReader{mode: unifiedmigrations.StorageModeDualWrite, targetVersion: "v1", hasTarget: true})
		require.Error(t, svc.ValidateServedVersions(context.Background(), gr, onlyV1alpha1))
	})

	t.Run("dynamic or undeclared target version is skipped", func(t *testing.T) {
		svc := newSvc(&versionedStatusReader{mode: unifiedmigrations.StorageModeUnified, hasTarget: false})
		require.NoError(t, svc.ValidateServedVersions(context.Background(), gr, onlyV1alpha1))
	})

	t.Run("nil status reader is skipped even when unified via config", func(t *testing.T) {
		// No statusReader: mode is resolved from config. Unified mode with a version
		// mismatch must still be skipped because the target version is unknowable here.
		svc := &storageService{
			cfg: &setting.Cfg{UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				gr.String(): {DualWriterMode: rest.Mode5},
			}},
			metrics: provideDualWriterMetrics(prometheus.NewRegistry()),
		}
		require.NoError(t, svc.ValidateServedVersions(context.Background(), gr, onlyV1alpha1))
	})
}
