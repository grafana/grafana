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

func UnstructuredToLegacyShortURL(item unstructured.Unstructured) (*shorturls.ShortUrl, error) {
	path, found, err := unstructured.NestedString(item.Object, "spec", "path")
	if err != nil {
		return nil, fmt.Errorf("shorturl %q: invalid spec.path: %w", item.GetName(), err)
	}
	if !found {
		return nil, fmt.Errorf("shorturl %q: missing spec.path", item.GetName())
	}

	// lastSeenAt is optional. Numbers in an Unstructured may be decoded as either int64
	// (k8s codec) or float64 (plain JSON unmarshal), so accept both rather than asserting
	// a single concrete type.
	lastSeen, found, err := unstructured.NestedNumberAsFloat64(item.Object, "status", "lastSeenAt")
	if err != nil {
		return nil, fmt.Errorf("shorturl %q: invalid status.lastSeenAt: %w", item.GetName(), err)
	}
	var lastSeenAt int64
	if found {
		lastSeenAt = int64(lastSeen)
	}

	return &shorturls.ShortUrl{
		Uid:        item.GetName(),
		Path:       path,
		LastSeenAt: lastSeenAt,
	}, nil
}
