package loganalytics

var Tables = []string{"availabilityResults", "dependencies", "customEvents", "exceptions", "pageViews", "requests", "traces"}

// AttributesOmit - Properties to omit when generating the attributes bag
var AttributesOmit = map[string]string{"operationId": "operationId", "duration": "duration", "id": "id", "name": "name", "problemId": "problemId", "operation_ParentId": "operation_ParentId", "timestamp": "timestamp", "customDimensions": "customDimensions", "operation_Name": "operation_Name"}

// CommonProperties - common resource centric properties mapped to legacy property names
var CommonProperties = map[string]string{
	"appId":                     "ResourceGUID",
	"application_Version":       "AppVersion",
	"appName":                   "_ResourceId",
	"client_Browser":            "ClientBrowser",
	"client_City":               "ClientCity",
	"client_CountryOrRegion":    "ClientCountryOrRegion",
	"client_IP":                 "ClientIP",
	"client_Model":              "ClientModel",
	"client_OS":                 "ClientOS",
	"client_StateOrProvince":    "ClientStateOrProvince",
	"client_Type":               "ClientType",
	"cloud_RoleInstance":        "AppRoleInstance",
	"cloud_RoleName":            "AppRoleName",
	"customDimensions":          "Properties",
	"customMeasurements":        "Measurements",
	"duration":                  "DurationMs",
	"id":                        "Id",
	"iKey":                      "IKey",
	"itemCount":                 "ItemCount",
	"itemId":                    "_ItemId",
	"itemType":                  "Type",
	"name":                      "Name",
	"operation_Id":              "OperationId",
	"operation_Name":            "OperationName",
	"operation_ParentId":        "OperationParentId",
	"operation_SyntheticSource": "OperationSyntheticSource",
	"performanceBucket":         "PerformanceBucket",
	"sdkVersion":                "SDKVersion",
	"session_Id":                "SessionId",
	"success":                   "Success",
	"timestamp":                 "TimeGenerated",
	"user_AccountId":            "UserAccountId",
	"user_AuthenticatedId":      "UserAuthenticatedId",
	"user_Id":                   "UserId",
}

func copyCommonProperties(dst map[string]string, omit map[string]string) map[string]string {
	for k, v := range CommonProperties {
		if _, ok := omit[k]; !ok {
			dst[k] = v
		}
	}
	return dst
}

var emptyMap = map[string]string{}

var AvailabilityResultsSchema = copyCommonProperties(map[string]string{
	"location": "Location",
	"message":  "Message",
	"size":     "Size",
}, emptyMap)

var DependenciesSchema = copyCommonProperties(map[string]string{
	"data":       "Data",
	"resultCode": "ResultCode",
	"target":     "Target",
	"type":       "DependencyType",
}, emptyMap)

var EventsSchema = copyCommonProperties(map[string]string{}, map[string]string{"duration": "duration", "id": "id", "success": "success", "performanceBucket": "performanceBucket"})

var PageViewsSchema = copyCommonProperties(map[string]string{"url": "Url"}, map[string]string{"success": "success"})

var RequestsSchema = copyCommonProperties(map[string]string{"resultCode": "ResultCode",
	"source": "Source",
	"url":    "Url"}, map[string]string{})

var ExceptionsSchema = copyCommonProperties(map[string]string{
	"assembly":          "Assembly",
	"details":           "Details",
	"handledAt":         "HandledAt",
	"innermostAssembly": "InnermostAssembly",
	"innermostMessage":  "InnermostMessage",
	"innermostMethod":   "InnermostMethod",
	"innermostType":     "InnermostType",
	"message":           "Message",
	"method":            "Method",
	"outerAssembly":     "OuterAssembly",
	"outerMessage":      "OuterMessage",
	"outerMethod":       "OuterMethod",
	"outerType":         "OuterType",
	"problemId":         "ProblemId",
	"severityLevel":     "SeverityLevel",
	"type":              "ExceptionType",
	// Grafana specific error tag
	"error": "error",
}, map[string]string{"duration": "duration", "id": "id", "name": "name", "performanceBucket": "performanceBucket", "success": "success"})

var TracesSchema = copyCommonProperties(map[string]string{
	"message":       "Message",
	"severityLevel": "SeverityLevel",
}, map[string]string{"duration": "duration", "id": "id", "name": "name", "performanceBucket": "performanceBucket", "success": "success"})

var TablesSchema = map[string]map[string]string{
	"availabilityResults": AvailabilityResultsSchema,
	"dependencies":        DependenciesSchema,
	"customEvents":        EventsSchema,
	"exceptions":          ExceptionsSchema,
	"pageViews":           PageViewsSchema,
	"requests":            RequestsSchema,
	"traces":              TracesSchema,
}

func getTagsForTable(table string) []string {
	tagsMap := TablesSchema[table]
	tags := []string{}

	for k := range tagsMap {
		tags = append(tags, k)
	}

	return tags
}
