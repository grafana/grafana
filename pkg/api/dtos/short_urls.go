package dtos

type CreateShortURLForm struct {
	Path string `json:"path" binding:"Required"`
}
