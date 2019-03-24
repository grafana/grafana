package dtos

import "time"

type UserToken struct {
	Id        int64     `json:"id"`
	IsActive  bool      `json:"isActive"`
	ClientIp  string    `json:"clientIp"`
	UserAgent string    `json:"userAgent"`
	CreatedAt time.Time `json:"createdAt"`
	SeenAt    time.Time `json:"seenAt"`
}
