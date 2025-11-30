// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type GetSearchUserRequestParams struct {
	Query  string `json:"query"`
	Limit  int64  `json:"limit,omitempty"`
	Offset int64  `json:"offset,omitempty"`
}

// NewGetSearchUserRequestParams creates a new GetSearchUserRequestParams object.
func NewGetSearchUserRequestParams() *GetSearchUserRequestParams {
	return &GetSearchUserRequestParams{}
}
