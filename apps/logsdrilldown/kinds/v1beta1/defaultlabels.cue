package v1beta1

#LogsLogsDefaultLabelsRecord: {
	label:   string
	values: [...string]
}

#LogsLogsDefaultLabelsRecords: [...#LogsLogsDefaultLabelsRecord]

LogsDefaultLabels: {
	records: #LogsLogsDefaultLabelsRecords
}
