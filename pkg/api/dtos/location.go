package dtos

type Location struct {
	Id        int64  `json:"id"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	Country   string `json:"country"`
	Region    string `json:"region"`
	Provider  string `json:"provider"`
	Public    bool   `json:"public"`
}
