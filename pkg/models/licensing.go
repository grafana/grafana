package models

type Licensing interface {
	HasValidLicense() bool
}
