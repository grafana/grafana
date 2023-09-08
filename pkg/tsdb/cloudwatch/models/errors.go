package models

// put misc expected user errors here

type MissingRegion struct{}

func (e *MissingRegion) Error() string {
	return "missing default or selected region"
}
