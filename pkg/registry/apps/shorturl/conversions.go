package shorturl

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	shorturl "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/shorturls"
)

func convertToK8sResource(v *shorturls.ShortUrl, namespacer request.NamespaceMapper) *shorturl.ShortURL {
	spec := shorturl.ShortURLSpec{
		Path: v.Path,
	}
	status := shorturl.ShortURLStatus{
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
		Spec:   spec,
		Status: status,
	}
	return p
}
