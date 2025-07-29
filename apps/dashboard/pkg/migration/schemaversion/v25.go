package schemaversion

// V25 migration is a no-op migration
// It only updates the schema version to 25
// It's created to keep the migration history consistent with frontend migrator
// Variable tag removal is handled in v28 migration

// Example before migration:
// {
// "templating": {
// 	"list": [
// 	  {
// 		"name": "tags should not be removed",
// 		"type": "query",
// 		"datasource": "prometheus",
// 		"tags": ["tags should not be removed"],
// 		"tagsQuery": "tag should not be removed",
// 		"tagValuesQuery": "tag should not be removed",
// 		"useTags": true,
// 		"options": []

// 	  }
// 	]
//   }
// }

// Example after migration:
// {
// "templating": {
// 	"list": [
// 	  {
// 		"name": "tags should not be removed",
// 		"type": "query",
// 		"datasource": "prometheus",
// 		"tags": ["tags should not be removed"],
// 		"tagsQuery": "tag should not be removed",
// 		"tagValuesQuery": "tag should not be removed",
// 		"useTags": true,
// 		"options": []

// 	  }
// 	]
//   }
// }

func V25(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = int(25)
	return nil
}
