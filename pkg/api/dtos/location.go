package dtos

type Location struct {
	Id        int64  `json:"id"`
	AccountId int64  `json:"accountId"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	Country   string `json:"country"`
	Region    string `json:"region"`
	Provider  string `json:"provider"`
}
