package v1alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var SchemeGroupVersion = schema.GroupVersion{Group: APIGroup, Version: APIVersion}

var PendingFolderDeletionResourceInfo = utils.NewResourceInfo(APIGroup, APIVersion,
	"pendingfolderdeletions", "pendingfolderdeletion", "PendingFolderDeletion",
	func() runtime.Object { return &PendingFolderDeletion{} },
	func() runtime.Object { return &PendingFolderDeletionList{} },
	utils.TableColumns{},
)
