package dtos

type ShortURL struct {
	UID string `json:"uid"`
	URL string `json:"url"`
}

type CreateShortURLCmd struct {
	Path string `json:"path"`
	UID  string `json:"uid,omitempty"`
}
