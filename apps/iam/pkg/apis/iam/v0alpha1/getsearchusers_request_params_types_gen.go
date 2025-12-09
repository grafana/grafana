// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type GetSearchUsersRequestParams struct {
	Query  string `json:"query"`
	Limit  int64  `json:"limit,omitempty"`
	Offset int64  `json:"offset,omitempty"`
}

// NewGetSearchUsersRequestParams creates a new GetSearchUsersRequestParams object.
func NewGetSearchUsersRequestParams() *GetSearchUsersRequestParams {
	return &GetSearchUsersRequestParams{}
}
