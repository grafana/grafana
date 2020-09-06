package dtos

type CreateShortUrlForm struct {
	Path string `json:"path" binding:"Required"`
}
