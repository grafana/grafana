package shorturl

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	shorturl "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/shorturls"
)

func convertToK8sResource(v *shorturls.ShortUrl, namespacer request.NamespaceMapper) *shorturl.ShortURL {
	spec := shorturl.ShortURLSpec{
		Path:       v.Path,
		LastSeenAt: v.LastSeenAt,
	}
	p := &shorturl.ShortURL{
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Uid,
			UID:               types.UID(v.Uid),
			ResourceVersion:   fmt.Sprintf("%d", v.LastSeenAt),
			CreationTimestamp: metav1.NewTime(time.UnixMilli(v.CreatedAt)),
			Namespace:         namespacer(v.OrgId),
		},
		Spec: spec,
	}
	meta, err := utils.MetaAccessor(p)
	if err == nil {
		meta.SetUpdatedTimestampMillis(v.LastSeenAt)
		if v.Id > 0 {
			meta.SetDeprecatedInternalID(v.Id) // nolint:staticcheck
		}
	}

	p.UID = gapiutil.CalculateClusterWideUID(p)
	return p
}

func convertToLegacyResource(p *shorturl.ShortURL, orgId int64) (*shorturls.ShortUrl, error) {
	return &shorturls.ShortUrl{
		Uid:        p.Spec.Uid,
		OrgId:      orgId,
		Path:       p.Spec.Path,
		LastSeenAt: p.Spec.LastSeenAt,
	}, nil
}

func LegacyCreateCommandToUnstructured(cmd dtos.CreateShortURLCmd) unstructured.Unstructured {
	obj := unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": map[string]interface{}{
				"path": cmd.Path,
			},
		},
	}
	return obj
}

func UnstructuredToLegacyShortURLDTO(item unstructured.Unstructured) *dtos.ShortURL {
	spec := item.Object["spec"].(map[string]any)
	return &dtos.ShortURL{
		UID: item.GetName(),
		URL: spec["shortURL"].(string),
	}
}
