package config

import (
	"strings"

	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var kind = v0alpha1.ConfigKind()

var ResourceInfo = utils.NewResourceInfo(kind.Group(), kind.Version(),
	kind.GroupVersionResource().Resource, strings.ToLower(kind.Kind()), kind.Kind(),
	func() runtime.Object { return kind.ZeroValue() },
	func() runtime.Object { return kind.ZeroListValue() },
	utils.TableColumns{},
)
