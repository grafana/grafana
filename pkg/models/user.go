package models

type Password string

func (p Password) IsWeak() bool {
	return len(p) <= 4
}

type UserIdDTO struct {
	Id      int64  `json:"id"`
	Message string `json:"message"`
}
