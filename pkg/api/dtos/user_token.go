package dtos

import "time"

type UserToken struct {
	Id                     int64     `json:"id"`
	IsActive               bool      `json:"isActive"`
	ClientIp               string    `json:"clientIp"`
	Device                 string    `json:"device"`
	OperatingSystem        string    `json:"os"`
	OperatingSystemVersion string    `json:"osVersion"`
	Browser                string    `json:"browser"`
	BrowserVersion         string    `json:"browserVersion"`
	AuthModule             string    `json:"authModule"`
	CreatedAt              time.Time `json:"createdAt"`
	SeenAt                 time.Time `json:"seenAt"`
}
