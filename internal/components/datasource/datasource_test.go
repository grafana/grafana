package datasource

import (
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestCR (t *testing.T) {
	o := &CR {
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-datasource",
		},
		Spec: Model{
			Type: "prom",
			Access: "proxy",
			Url: "http://localhost:9090",
			BasicAuth: true,
			BasicAuthUser: "admin",
			//SecureJsonFields: map[string]bool{"basicAuthPassword": true},
		},	
	}

	var _ runtime.Object = o
}