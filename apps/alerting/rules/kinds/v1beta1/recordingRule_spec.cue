package v1beta1

#RecordingRuleSpec: #RuleSpec & {
	metric:              #MetricName
	targetDatasourceUID: #DatasourceUID
}

// TODO(@moustafab): validate the metric name regex

#MetricName: string & =~"^[a-zA-Z_:][a-zA-Z0-9_:]*$"
