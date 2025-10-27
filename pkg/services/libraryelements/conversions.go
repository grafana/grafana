package libraryelements

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
)

func ToCreateLibraryElementCommand(raw runtime.Object) (*model.CreateLibraryElementCommand, error) {
	obj, err := utils.MetaAccessor(raw)
	if err != nil {
		return nil, err
	}
	folder := obj.GetFolder()
	cmd := &model.CreateLibraryElementCommand{
		UID:       obj.GetName(),
		FolderUID: &folder,
		Kind:      1, // the only kind... LibraryPanel
		Name:      obj.FindTitle("library panel"),
	}
	cmd.Model, err = toRawMessage(raw)
	return cmd, err
}

func ToPatchLibraryElementCommand(raw runtime.Object) (*model.PatchLibraryElementCommand, error) {
	obj, err := utils.MetaAccessor(raw)
	if err != nil {
		return nil, err
	}
	folder := obj.GetFolder()
	cmd := &model.PatchLibraryElementCommand{
		UID:       obj.GetName(),
		FolderUID: &folder,
		Kind:      1, // the only kind... LibraryPanel
		Name:      obj.FindTitle("library panel"),
	}
	cmd.Model, err = toRawMessage(raw)
	return cmd, err
}

func toRawMessage(raw runtime.Object) (json.RawMessage, error) {
	switch obj := raw.(type) {
	case *v0alpha1.LibraryPanel:
		fmt.Printf("Twice %+v\n", obj)
	}
	return nil, fmt.Errorf("unsupported library panel type: %T", raw)
}
