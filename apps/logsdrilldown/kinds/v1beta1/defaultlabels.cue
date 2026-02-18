package v1beta1

#LogsLogsDefaultLabelsRecord: {
	labels: [...string]
}

#LogsLogsDefaultLabelsRecords: [...#LogsLogsDefaultLabelsRecord]

LogsDefaultLabels: {
	records: #LogsLogsDefaultLabelsRecords
}
