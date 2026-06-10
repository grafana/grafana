package v0alpha1

RecordingRuleSpec: #RuleSpec & {
	metric:              #MetricName
	targetDatasourceUID: #DatasourceUID
}

#MetricName: string & =~"^[a-zA-Z_:][a-zA-Z0-9_:]*$"
