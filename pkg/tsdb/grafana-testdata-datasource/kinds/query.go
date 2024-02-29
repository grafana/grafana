package kinds

import (
	"embed"
	"encoding/json"
)

//go:embed query.types.json
var f embed.FS

// QueryTypeDefinitionsJSON returns the query type definitions
func QueryTypeDefinitionsJSON() (json.RawMessage, error) {
	return f.ReadFile("query.types.json")
}
