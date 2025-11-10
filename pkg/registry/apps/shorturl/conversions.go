package shorturl

import (
	"fmt"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	shorturl "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1beta1"
	"github.com/grafana/grafana/pkg/api/dtos"
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

	// resourceVersion can't be 0, since we are using the lastSeenAt value, when it's zero we default to current time
	resourceVersion := fmt.Sprintf("%d", v.LastSeenAt)
	if v.LastSeenAt == 0 {
		resourceVersion = fmt.Sprintf("%d", time.Now().Unix())
	}

	p := &shorturl.ShortURL{
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Uid,
			ResourceVersion:   resourceVersion,
			CreationTimestamp: metav1.NewTime(time.Unix(v.CreatedAt, 0)),
			Namespace:         namespacer(v.OrgId),
		},
		Spec:   spec,
		Status: status,
	}
	return p
}

func LegacyCreateCommandToUnstructured(cmd dtos.CreateShortURLCmd) unstructured.Unstructured {
	obj := unstructured.Unstructured{
		Object: map[string]interface{}{
			"metadata": map[string]interface{}{
				"name": cmd.UID,
			},
			"spec": map[string]interface{}{
				"path": cmd.Path,
			},
		},
	}
	return obj
}

func UnstructuredToLegacyShortURLDTO(item unstructured.Unstructured, appURL string) *dtos.ShortURL {
	url := fmt.Sprintf("%s/goto/%s?orgId=%s", strings.TrimSuffix(appURL, "/"), item.GetName(), item.GetNamespace())

	return &dtos.ShortURL{
		UID: item.GetName(),
		URL: url,
	}
}

func UnstructuredToLegacyShortURL(item unstructured.Unstructured) *shorturls.ShortUrl {
	spec := item.Object["spec"].(map[string]interface{})
	status := item.Object["status"].(map[string]interface{})

	return &shorturls.ShortUrl{
		Uid:        item.GetName(),
		Path:       spec["path"].(string),
		LastSeenAt: status["lastSeenAt"].(int64),
	}
}
