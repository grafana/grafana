package search

const (
	fieldName                = "name"
	fieldTitle               = "title"
	fieldFolder              = "folder"
	fieldInterval            = "interval"
	fieldPaused              = "paused"
	fieldType                = "type"
	fieldLabels              = "labels"
	fieldDatasourceUIDs      = "datasourceUIDs"
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
	fieldHealth              = "health"
	fieldLastEvaluationTime  = "lastEvaluationTime"
	fieldLastError           = "lastError"
	fieldEvaluationDuration  = "evaluationDuration"
	fieldState               = "state"
	fieldStateReason         = "stateReason"
)

var resultColumns = []string{
	fieldType, fieldTitle, fieldFolder, fieldInterval, fieldPaused, fieldLabels, fieldDatasourceUIDs,
	fieldAnnotations, fieldFor, fieldKeepFiringFor,
	fieldDashboardUID, fieldPanelID, fieldReceiver, fieldNotificationType, fieldRoutingTree,
	fieldMetric, fieldTargetDatasourceUID,
	fieldHealth, fieldLastEvaluationTime, fieldLastError, fieldEvaluationDuration, fieldState, fieldStateReason,
}
