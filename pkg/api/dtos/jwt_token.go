// BMC File
package dtos

type JWTToken struct {
	Token string `json:"json_web_token"`
	Expiry   string `json:"exp"`
}

type IMSPayload struct {
	Token string `json:"json_web_token"`
}