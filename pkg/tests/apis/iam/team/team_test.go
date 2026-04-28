package team

import (
	"testing"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/tests/testsuite"
)

var gvrTeams = schema.GroupVersionResource{
	Group:    "iam.grafana.app",
	Version:  "v0alpha1",
	Resource: "teams",
}

var gvrUsers = schema.GroupVersionResource{
	Group:    "iam.grafana.app",
	Version:  "v0alpha1",
	Resource: "users",
}

var gvrTeamBindings = schema.GroupVersionResource{
	Group:    "iam.grafana.app",
	Version:  "v0alpha1",
	Resource: "teambindings",
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}
