package serviceauth

type AuthProvider string

const (
	ServiceAccounts AuthProvider = "ServiceAccounts"
	OAuth2Server    AuthProvider = "OAuth2Server"
)
