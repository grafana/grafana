package prometheus

import (
	"fmt"

	prometheus "github.com/grafana/grafana/apps/prometheus/pkg/apis/prometheus/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	datasources "github.com/grafana/grafana/pkg/services/datasources"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

// TODO I did just enough to get rid of red lines when copying over from playlist. Lots of logic to go into here.
// TODO how do we will in the spec for an "unstructured" object?
func convertToK8sResource(v *datasources.DataSource, namespacer request.NamespaceMapper) *prometheus.Prometheus {
	spec := prometheus.PrometheusSpec{}

	p := &prometheus.Prometheus{
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Type + "-" + v.UID,
			UID:               types.UID(v.UID),
			ResourceVersion:   fmt.Sprintf("%d", v.Updated),
			CreationTimestamp: metav1.NewTime(v.Created),
			Namespace:         namespacer(v.OrgID),
		},
		Spec: spec,
	}
	meta, err := utils.MetaAccessor(p)
	if err == nil {
		meta.SetUpdatedTimestampMillis(v.Updated.UnixMilli())
		if v.ID > 0 {
			meta.SetDeprecatedInternalID(v.ID) // nolint:staticcheck
		}
	}

	p.UID = gapiutil.CalculateClusterWideUID(p)
	return p
}
