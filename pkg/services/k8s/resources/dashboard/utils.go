package dashboard

import (
	"crypto/sha256"
	"fmt"
	"unicode"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/k8s/crd"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation"
)

// TODO: we likely want each org to map to a single namespace
func GetOrgIDFromNamespace(namespace string) int64 {
	// TODO... for now everyone is org 1
	return 1
}

// This makes an consistent mapping between Grafana UIDs and k8s compatible names
func GrafanaUIDToK8sName(uid string) string {
	if hasNoUppercase(uid) && validation.IsQualifiedName(uid) == nil {
		return uid // OK, so just use it directly
	}

	//  ¯\_(ツ)_/¯  really should do an alias or something
	h := sha256.New()
	_, _ = h.Write([]byte(uid))
	bs := h.Sum(nil)
	return fmt.Sprintf("g%x", bs[:12])
}

func hasNoUppercase(s string) bool {
	for _, r := range s {
		if unicode.IsUpper(r) {
			return false
		}
	}
	return true
}

func stripNulls(j *simplejson.Json) {
	m, err := j.Map()
	if err != nil {
		arr, err := j.Array()
		if err == nil {
			for i := range arr {
				stripNulls(j.GetIndex(i))
			}
		}
		return
	}
	for k, v := range m {
		if v == nil {
			j.Del(k)
		} else {
			stripNulls(j.Get(k))
		}
	}
}

// toUnstructured converts a Dashboard to an *unstructured.Unstructured.
func dtoToUnstructured(dto *dashboards.Dashboard, metadata metav1.ObjectMeta) (*unstructured.Unstructured, error) {
	dashboardObj := crd.Base[dashboard.Dashboard]{
		TypeMeta: metav1.TypeMeta{
			Kind:       CRD.GVK().Kind,
			APIVersion: CRD.GVK().Group + "/" + CRD.GVK().Version,
		},
		ObjectMeta: metadata,
	}

	out, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&dashboardObj)
	if err != nil {
		return nil, err
	}

	spec, err := dto.Data.Map()
	if err != nil {
		return nil, err
	}
	out["spec"] = spec

	return &unstructured.Unstructured{
		Object: out,
	}, nil
}
