package token

// StoreType selects which backend owns service account tokens.
type StoreType string

const (
	// StoreTypeEmbedded stores tokens in the Grafana database.
	StoreTypeEmbedded StoreType = "embedded"
	// StoreTypeMT forwards tokens to the iam.grafana.app token store service.
	StoreTypeMT StoreType = "mt"
)
