package v0alpha1

import (
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func (in *Dashboard) MutateInternalID() error {
	if id, ok := in.Spec.Object["id"].(float64); ok {
		delete(in.Spec.Object, "id")
		if id != 0 {
			meta, err := utils.MetaAccessor(in)
			if err != nil {
				return err
			}
			meta.SetDeprecatedInternalID(int64(id)) // nolint:staticcheck
		}
	}
	return nil
}
