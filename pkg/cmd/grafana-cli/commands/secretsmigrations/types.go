package secretsmigrations

type simpleSecret struct {
	tableName       string
	columnName      string
	isBase64Encoded bool
	hasUpdatedCol   bool
}

type jsonSecret struct {
	tableName string
}

type alertingSecret struct{}
