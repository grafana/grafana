package models

type Provisionable interface {
	GetProvenance() string
}

type Meta struct {
	Provenance string `json:"provenance"`
}

func (cmd Meta) GetProvenance() string {
	return cmd.Provenance
}
