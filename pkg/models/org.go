package models

type OrgDetailsDTO struct {
	Id      int64   `json:"id"`
	Name    string  `json:"name"`
	Address Address `json:"address"`
}
