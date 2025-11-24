package v0alpha1

#LogsDefaultColumnsLabels: [...{
	key: string,
	value: string
}]

#LogsDefaultColumnsRecords: [...{
	columns: [...string],
	labels: #LogsDefaultColumnsLabels
}]

#LogsDefaultColumnsDatasource: {
	records: #LogsDefaultColumnsRecords
}

LogsDefaultColumns: {
	datasource: #LogsDefaultColumnsDatasource
}
