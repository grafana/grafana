// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type GetSearchUsersRequestParams struct {
	Query  *string `json:"query,omitempty"`
	Limit  int64   `json:"limit,omitempty"`
	Offset int64   `json:"offset,omitempty"`
	Page   int64   `json:"page,omitempty"`
}

// NewGetSearchUsersRequestParams creates a new GetSearchUsersRequestParams object.
func NewGetSearchUsersRequestParams() *GetSearchUsersRequestParams {
	return &GetSearchUsersRequestParams{}
}
