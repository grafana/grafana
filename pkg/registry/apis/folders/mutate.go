package folders

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apiserver/pkg/admission"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/folder"
)

func (b *FolderAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	op := a.GetOperation()

	if op != admission.Create && op != admission.Update {
		return nil
	}
	obj := a.GetObject()
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}

	// TODO? before v1 and v2 final -- this should be required
	if meta.GetFolder() == "" {
		meta.SetFolder(folder.GeneralFolderUID) // "general"
	}

	f, ok := obj.(*folders.Folder)
	if !ok {
		return fmt.Errorf("obj is not folders.Folder")
	}
	f.Spec.Title = strings.Trim(f.Spec.Title, " ")
	return nil
}
