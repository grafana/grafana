package auth

type UserToken interface {
	GetUserId() int64
	GetToken() string
}
