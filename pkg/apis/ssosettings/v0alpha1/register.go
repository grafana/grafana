package v0alpha1

import (
	"fmt"
	"time"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	GROUP         = "ssosetting.grafana.app"
	VERSION       = "v0alpha1"
	APIVERSION    = GROUP + "/" + VERSION
	RESOURCE      = "ssosettings"
	GROUPRESOURCE = GROUP + "/" + RESOURCE
)

var SSOSettingResourceInfo = common.NewResourceInfo(
	GROUP, VERSION, RESOURCE, "ssosetting", "SSOSetting",
	func() runtime.Object { return &SSOSetting{} },
	func() runtime.Object { return &SSOSettingList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*SSOSetting)
			if !ok {
				return nil, fmt.Errorf("expected sso setting")
			}
			return []interface{}{
				m.Name,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	},
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
