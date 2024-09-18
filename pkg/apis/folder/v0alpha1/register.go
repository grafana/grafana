package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	GROUP      = "folder.grafana.app"
	VERSION    = "v0alpha1"
	RESOURCE   = "folders"
	APIVERSION = GROUP + "/" + VERSION
)

var FolderResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	RESOURCE, "folder", "Folder",
	func() runtime.Object { return &Folder{} },
	func() runtime.Object { return &FolderList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
