package shorturl

import (
	"fmt"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"
	"time"

	shorturl "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/shorturls"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
		Uid:        p.Name,
		OrgId:      orgId,
		Path:       p.Spec.Path,
		LastSeenAt: p.Spec.LastSeenAt,
	}, nil
}

// Read legacy ID from metadata annotations
func getLegacyID(item *unstructured.Unstructured) int64 {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return 0
	}
	return meta.GetDeprecatedInternalID() // nolint:staticcheck
}
