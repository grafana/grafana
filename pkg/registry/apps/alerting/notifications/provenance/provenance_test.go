package provenance

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestSetAnnotations(t *testing.T) {
	t.Run("known manager sets manager annotations and derives the provenance", func(t *testing.T) {
		obj := &model.TimeInterval{}
		terraform := utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "tf-id"}

		prov := SetAnnotations(obj, ngmodels.ProvenanceNone, terraform)

		assert.Equal(t, ngmodels.ProvenanceAPI, prov)
		assert.Equal(t, string(ngmodels.ProvenanceAPI), obj.GetProvenanceStatus())
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		got, ok := meta.GetManagerProperties()
		require.True(t, ok)
		assert.Equal(t, terraform, got)
	})

	t.Run("unknown manager keeps the given provenance and sets no manager annotations", func(t *testing.T) {
		obj := &model.TimeInterval{}

		prov := SetAnnotations(obj, ngmodels.ProvenanceConvertedPrometheus, utils.ManagerProperties{})

		assert.Equal(t, ngmodels.ProvenanceConvertedPrometheus, prov)
		assert.Equal(t, string(ngmodels.ProvenanceConvertedPrometheus), obj.GetProvenanceStatus())
		assert.NotContains(t, obj.GetAnnotations(), utils.AnnoKeyManagerKind)
	})
}

func TestFromAnnotations(t *testing.T) {
	t.Run("manager annotations win", func(t *testing.T) {
		obj := &model.TimeInterval{}
		terraform := utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "tf-id"}
		SetAnnotations(obj, ngmodels.ProvenanceNone, terraform)

		prov, manager, err := FromAnnotations(obj)

		require.NoError(t, err)
		assert.Equal(t, ngmodels.ProvenanceAPI, prov)
		assert.Equal(t, terraform, manager)
	})

	t.Run("falls back to the provenance annotation", func(t *testing.T) {
		obj := &model.TimeInterval{}
		obj.SetProvenanceStatus(string(ngmodels.ProvenanceFile))

		prov, manager, err := FromAnnotations(obj)

		require.NoError(t, err)
		assert.Equal(t, ngmodels.ProvenanceFile, prov)
		assert.Equal(t, ngmodels.ProvenanceToManagerProperties(ngmodels.ProvenanceFile), manager)
	})

	t.Run("no annotations means no provenance and no manager", func(t *testing.T) {
		prov, manager, err := FromAnnotations(&model.TimeInterval{})

		require.NoError(t, err)
		assert.Equal(t, ngmodels.ProvenanceNone, prov)
		assert.Equal(t, utils.ManagerProperties{}, manager)
	})

	t.Run("rejects a provenance annotation that disagrees with the manager", func(t *testing.T) {
		obj := &model.TimeInterval{}
		SetAnnotations(obj, ngmodels.ProvenanceNone, utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "tf-id"})
		obj.SetProvenanceStatus(string(ngmodels.ProvenanceFile))

		_, _, err := FromAnnotations(obj)

		require.ErrorContains(t, err, "inconsistent")
	})

	t.Run("rejects an unknown provenance", func(t *testing.T) {
		obj := &model.TimeInterval{}
		obj.SetProvenanceStatus("bogus")

		_, _, err := FromAnnotations(obj)

		require.Error(t, err)
	})
}
