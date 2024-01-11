package dtos

type SlackChannel struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}
type SlackChannels struct {
	Channels []SlackChannel `json:"channels"`
}
