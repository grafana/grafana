package dtos

type Location struct {
	Id        int64  `json:"id"`
	Slug      string `json:"slug"`
	Name      string `json:"name"`
	Country   string `json:"country"`
	Region    string `json:"region"`
	Provider  string `json:"provider"`
	Public    bool   `json:"public"`
}
