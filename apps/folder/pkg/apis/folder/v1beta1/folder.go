// Package v1beta1 re-exports the Folder resource types from v1 while registering
// folder.grafana.app/v1beta1 on the app-sdk resource.Kind (see FolderKind).
package v1beta1

import (
	"errors"

	"github.com/grafana/grafana-app-sdk/resource"
	v1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

type (
	Folder          = v1.Folder
	FolderList      = v1.FolderList
	FolderSpec      = v1.FolderSpec
	FolderJSONCodec = v1.FolderJSONCodec
)

var (
	NewFolder     = v1.NewFolder
	NewFolderSpec = v1.NewFolderSpec
)

var (
	schemaFolder = resource.NewSimpleSchema(APIGroup, APIVersion, NewFolder(), &FolderList{},
		resource.WithKind("Folder"),
		resource.WithPlural("folders"),
		resource.WithScope(resource.NamespacedScope),
		resource.WithSelectableFields([]resource.SelectableField{{
			FieldSelector: "spec.title",
			FieldValueFunc: func(o resource.Object) (string, error) {
				cast, ok := o.(*Folder)
				if !ok {
					return "", errors.New("provided object must be of type *Folder")
				}
				return cast.Spec.Title, nil
			},
		}}))
	kindFolder = resource.Kind{
		Schema: schemaFolder,
		Codecs: map[resource.KindEncoding]resource.Codec{
			resource.KindEncodingJSON: &FolderJSONCodec{},
		},
	}
)

func FolderKind() resource.Kind {
	return kindFolder
}

func FolderSchema() *resource.SimpleSchema {
	return schemaFolder
}

var _ resource.Schema = kindFolder
