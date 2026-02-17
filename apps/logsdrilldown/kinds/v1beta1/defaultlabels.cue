package v1beta1

#LogsLogsDefaultLabelsRecord: {
	dsUid: string
	labels: [...string]
}

#LogsLogsDefaultLabelsRecords: [...#LogsLogsDefaultLabelsRecord]

LogsDefaultLabels: {
	records: #LogsLogsDefaultLabelsRecords
}
