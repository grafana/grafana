package auth

type RevokeAuthTokenCmd struct {
	AuthTokenId int64 `json:"authTokenId"`
}
