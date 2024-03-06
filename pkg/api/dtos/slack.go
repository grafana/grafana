package dtos

type SlackChannel struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}
type SlackChannels struct {
	Channels []SlackChannel `json:"channels"`
}

type ShareRequest struct {
	ChannelIds      []string `json:"channelIds"`
	ImagePreviewUrl string   `json:"imagePreviewUrl"`
	ResourcePath    string   `json:"resourcePath"`
	Title           string   `json:"title"`
	Message         string   `json:"message,omitempty"`
}
