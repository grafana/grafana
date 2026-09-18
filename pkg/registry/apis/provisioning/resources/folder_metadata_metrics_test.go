package resources

import (
	"errors"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func TestFolderReadOutcome(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{"found", nil, folderReadOutcomeFound},
		{"missing via repository error", repository.ErrFileNotFound, folderReadOutcomeMissing},
		{"missing via apierror", apierrors.NewNotFound(schema.GroupResource{}, "x"), folderReadOutcomeMissing},
		{"invalid", NewInvalidFolderMetadata("f", errors.New("bad json")), folderReadOutcomeInvalid},
		// ErrRefNotFound is a NotFound status error too, but a missing ref is a
		// real failure, not an absent _folder.json.
		{"ref not found is an error, not missing", repository.ErrRefNotFound, folderReadOutcomeError},
		{"error", errors.New("boom"), folderReadOutcomeError},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, folderReadOutcome(tt.err))
		})
	}
}

func TestFolderMetadataMetrics_recordRead(t *testing.T) {
	newReader := func(repoType provisioning.RepositoryType) *repository.MockReaderWriter {
		r := repository.NewMockReaderWriter(t)
		r.On("Config").Return(&provisioning.Repository{
			Spec: provisioning.RepositorySpec{Type: repoType},
		}).Maybe()
		return r
	}

	t.Run("records outcome and repository_type", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		m := newFolderMetadataMetrics(reg)

		m.recordRead(newReader(provisioning.GitRepositoryType), time.Now(), nil)
		m.recordRead(newReader(provisioning.GitRepositoryType), time.Now(), repository.ErrFileNotFound)
		m.recordRead(newReader(provisioning.GitHubRepositoryType), time.Now(), errors.New("boom"))

		assert.Equal(t, 1.0, counterValue(t, reg, string(provisioning.GitRepositoryType), folderReadOutcomeFound))
		assert.Equal(t, 1.0, counterValue(t, reg, string(provisioning.GitRepositoryType), folderReadOutcomeMissing))
		assert.Equal(t, 1.0, counterValue(t, reg, string(provisioning.GitHubRepositoryType), folderReadOutcomeError))
		assert.Equal(t, 0.0, counterValue(t, reg, string(provisioning.GitRepositoryType), folderReadOutcomeError))
	})

	t.Run("nil metrics records nothing and never touches the repository", func(t *testing.T) {
		var m *FolderMetadataMetrics
		r := repository.NewMockReaderWriter(t) // no Config expectation: must not be called
		assert.NotPanics(t, func() {
			m.recordRead(r, time.Now(), nil)
		})
	})
}

func counterValue(t *testing.T, reg *prometheus.Registry, repoType, outcome string) float64 {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)
	for _, f := range families {
		if f.GetName() != "grafana_provisioning_folder_metadata_reads_total" {
			continue
		}
		for _, m := range f.GetMetric() {
			labels := map[string]string{}
			for _, l := range m.GetLabel() {
				labels[l.GetName()] = l.GetValue()
			}
			if labels["repository_type"] == repoType && labels["outcome"] == outcome {
				return m.GetCounter().GetValue()
			}
		}
	}
	return 0
}
