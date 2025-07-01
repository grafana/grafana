package v0alpha1

import (
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func (u User) AuthID() string {
	meta, err := utils.MetaAccessor(&u)
	if err != nil {
		return ""
	}
	// TODO: Workaround until we move all definitions
	// After having all resource definitions here in the app, we can remove this
	// and we need to change the List authorization to use the MetaAccessor and the GetDeprecatedInternalID method
	//nolint:staticcheck
	return fmt.Sprintf("%d", meta.GetDeprecatedInternalID())
}

func (s ServiceAccount) AuthID() string {
	meta, err := utils.MetaAccessor(&s)
	if err != nil {
		return ""
	}
	// TODO: Workaround until we move all definitions
	// After having all resource definitions here in the app, we can remove this
	// and we need to change the List authorization to use the MetaAccessor and the GetDeprecatedInternalID method
	//nolint:staticcheck
	return fmt.Sprintf("%d", meta.GetDeprecatedInternalID())
}

func (t Team) AuthID() string {
	meta, err := utils.MetaAccessor(&t)
	if err != nil {
		return ""
	}
	// TODO: Workaround until we move all definitions
	// After having all resource definitions here in the app, we can remove this
	// and we need to change the List authorization to use the MetaAccessor and the GetDeprecatedInternalID method
	//nolint:staticcheck
	return fmt.Sprintf("%d", meta.GetDeprecatedInternalID())
}
