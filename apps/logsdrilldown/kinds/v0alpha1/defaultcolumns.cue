package v0alpha1

#LogsDefaultColumnsLabel: {
	key:   string
	value: string
}

#LogsDefaultColumnsLabels: [...#LogsDefaultColumnsLabel]

#LogsDefaultColumnsRecord: {
	columns: [...string]
	labels: #LogsDefaultColumnsLabels
}

#LogsDefaultColumnsRecords: [...#LogsDefaultColumnsRecord]

LogsDefaultColumns: {
	records: #LogsDefaultColumnsRecords
}
