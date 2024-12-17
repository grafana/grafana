package options

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestStorageOptions_CheckFeatureToggle(t *testing.T) {
	tests := []struct {
		name                 string
		StorageType          StorageType
		UnifiedStorageConfig map[string]setting.UnifiedStorageConfig
		features             any
		wantErr              bool
	}{
		{
			name:                 "with legacy storage",
			StorageType:          StorageTypeLegacy, // nolint:staticcheck
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{"playlists.playlist.grafana.app": {DualWriterMode: 2}},
			features:             featuremgmt.WithFeatures(),
		},
		{
			name:                 "with unified storage and without config for resource",
			StorageType:          StorageTypeUnified,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{},
			features:             featuremgmt.WithFeatures(),
		},
		{
			name:                 "with unified storage, mode > 1 and with toggle for resource",
			StorageType:          StorageTypeUnified,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{"playlists.playlist.grafana.app": {DualWriterMode: 2}},
			features:             featuremgmt.WithFeatures(featuremgmt.FlagKubernetesPlaylists),
		},
		{
			name:                 "with unified storage, mode > 1 and without toggle for resource",
			StorageType:          StorageTypeUnified,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{"playlists.playlist.grafana.app": {DualWriterMode: 2}},
			features:             featuremgmt.WithFeatures(),
			wantErr:              true,
		},
		{
			name:                 "with unified storage and mode = 1",
			StorageType:          StorageTypeUnified,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{"playlists.playlist.grafana.app": {DualWriterMode: 1}},
			features:             featuremgmt.WithFeatures(),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			o := &StorageOptions{
				StorageType:          tt.StorageType,
				UnifiedStorageConfig: tt.UnifiedStorageConfig,
			}
			err := o.EnforceFeatureToggleAfterMode1(tt.features.(featuremgmt.FeatureToggles))
			if tt.wantErr {
				return
			}
			assert.NoError(t, err)
		})
	}
}
