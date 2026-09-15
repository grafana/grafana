package authinfo

import (
	"testing"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/tests/testsuite"
)

var gvrUsers = schema.GroupVersionResource{
	Group:    "iam.grafana.app",
	Version:  "v0alpha1",
	Resource: "users",
}

var gvrAuthInfo = schema.GroupVersionResource{
	Group:    "iam.grafana.app",
	Version:  "v0alpha1",
	Resource: "authinfos",
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}
