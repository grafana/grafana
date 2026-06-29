package search

import "github.com/grafana/grafana/pkg/storage/unified/resource"

// Search request requirement keys and result column names shared by the legacy
// and unified backends (and the unified document builder). Title and folder
// reuse the standard search fields; the rest are rule-specific.
const (
	fieldName           = resource.SEARCH_FIELD_NAME
	fieldTitle          = resource.SEARCH_FIELD_TITLE
	fieldFolder         = resource.SEARCH_FIELD_FOLDER
	fieldGroup          = "group"
	fieldInterval       = "interval"
	fieldPaused         = "paused"
	fieldType           = "type"
	fieldLabels         = "labels"
	fieldDatasourceUIDs = "datasourceUIDs"

	fieldAnnotations         = "annotations"
	fieldFor                 = "for"
	fieldKeepFiringFor       = "keepFiringFor"
	fieldDashboardUID        = "dashboardUID"
	fieldPanelID             = "panelID"
	fieldReceiver            = "receiver"
	fieldNotificationType    = "notificationType"
	fieldRoutingTree         = "routingTree"
	fieldMetric              = "metric"
	fieldTargetDatasourceUID = "targetDatasourceUID"
)

// resultColumns are the columns every search result table carries, in order.
// Kind-specific columns are empty for the other kind.
var resultColumns = []string{
	fieldType, fieldTitle, fieldFolder, fieldGroup, fieldInterval, fieldPaused, fieldLabels, fieldDatasourceUIDs,
	fieldAnnotations, fieldFor, fieldKeepFiringFor,
	fieldDashboardUID, fieldPanelID, fieldReceiver, fieldNotificationType, fieldRoutingTree,
	fieldMetric, fieldTargetDatasourceUID,
}
