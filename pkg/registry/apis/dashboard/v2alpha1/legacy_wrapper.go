package v2alpha1

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	dashboardv2alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v2alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

// We should avoid saving v2 format into legacy SQL -- there is not, and likely will not be a good conversion
// This replaces the value saved in legacy SQL with a warning
// We can not (yet!) skip writing to the legacy tables because authz still relies on the existence
type wrapLegacyStorage struct {
	grafanarest.LegacyStorage
}

var staticWarningPanel = map[string]interface{}{
	"gridPos": map[string]interface{}{
		"h": 13,
		"w": 24, // full width
		"x": 0,
		"y": 0,
	},
	"options": map[string]interface{}{
		"mode": "html",
		"content": `<div style="background:#eb4438; color:#000; padding:50px; height:1000px;">
			<h1>This dashboard was saved using schema v2 🎉🎉🎉🎉🎉🎉<h1>
			<br/>
			<h1>It is not possible to load v2 dashboards from the SQL database<h1>
		</div>`,
	},
	"transparent": true,
	"type":        "text",
}

// Create creates a new version of a resource.
func (w *wrapLegacyStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	dash, ok := obj.(*dashboardv2alpha1.Dashboard)
	if !ok {
		return nil, fmt.Errorf("expecting v2 alpha dashboard")
	}
	dash.Spec = getDashboardSpec(dash.Name)
	return w.LegacyStorage.Create(ctx, dash, createValidation, options)
}

func getDashboardSpec(uid string) dashboardv2alpha1.DashboardSpec {
	// The obvious approach to just add `staticWarningPanel` to the panels array
	// fails with an error about DeepClone not working ¯\_(ツ)_/¯
	jj, _ := json.Marshal(staticWarningPanel)
	panel := make(map[string]interface{})
	_ = json.Unmarshal(jj, &panel)
	return dashboardv2alpha1.DashboardSpec{
		Unstructured: v0alpha1.Unstructured{
			Object: map[string]interface{}{
				"schemaVersion": 99999, // no more schemaVersion in v2!
				"title":         "v2alpha1 dashboard " + time.Now().Format(time.DateOnly),
				"uid":           uid,
				"panels":        []any{panel},
			},
		},
	}
}

// Create creates a new version of a resource.
func (w *wrapLegacyStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	dash := &dashboardv2alpha1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
		},
		Spec: getDashboardSpec(name),
	}

	fmt.Printf("Legacy UPDATE: %+v\n", objInfo)
	return w.LegacyStorage.Update(ctx, name,
		&updatedObjectInfoWrapper{obj: dash}, // force the new object
		createValidation, updateValidation, forceAllowCreate, options)
}

type updatedObjectInfoWrapper struct {
	obj runtime.Object
}

func (w *updatedObjectInfoWrapper) Preconditions() *metav1.Preconditions {
	return nil
}

func (w *updatedObjectInfoWrapper) UpdatedObject(ctx context.Context, oldObj runtime.Object) (newObj runtime.Object, err error) {
	return w.obj, nil
}
