package v1

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const (
	GROUP         = "folder.grafana.app"
	VERSION       = "v1"
	RESOURCE      = "folders"
	APIVERSION    = GROUP + "/" + VERSION
	RESOURCEGROUP = RESOURCE + "." + GROUP
)

var FolderResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	RESOURCE, "folder", "Folder",
	func() runtime.Object { return &Folder{} },
	func() runtime.Object { return &FolderList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The display name"},
			{Name: "Parent", Type: "string", Format: "string", Description: "Parent folder UID"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			r, ok := obj.(*Folder)
			if ok {
				accessor, _ := utils.MetaAccessor(r)
				return []interface{}{
					r.Name,
					r.Spec.Title,
					accessor.GetFolder(),
				}, nil
			}
			return nil, fmt.Errorf("expected folder")
		},
	},
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
