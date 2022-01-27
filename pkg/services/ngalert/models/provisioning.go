package models

type Provenance string

const (
	None Provenance = ""
	Api  Provenance = "api"
	File Provenance = "file"
)

func GetResourceTypeIdentifier(o interface{}) string {
	switch o.(type) {
	case AlertRule:
		return "alertRule"
	default:
		return ""
	}
}

func GetResourceUniqueIdentifier(o interface{}) string {
	switch o.(type) {
	case AlertRule:
		return o.(AlertRule).UID
	default:
		return ""
	}
}
