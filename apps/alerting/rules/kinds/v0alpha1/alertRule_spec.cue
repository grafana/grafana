package v0alpha1

NoDataState:  *"NoData" | "Ok" | "Alerting" | "KeepLast"
ExecErrState: *"Error" | "Ok" | "Alerting" | "KeepLast"

#MuteTimeIntervalRef: string // TODO(@moustafab): validate regex for mute time interval ref

#ActiveTimeIntervalRef: string // TODO(@moustafab): validate regex for active time interval ref

AlertRuleSpec: #RuleSpec & {
	noDataState:  NoDataState
	execErrState: ExecErrState
	notificationSettings?: [...#NotificationSettings]
	"for":                        string & #PromDuration
	keepFiringFor:                string & #PromDuration
	missingSeriesEvalsToResolve?: int
	annotations: {
		[string]: TemplateString
	}
	dashboardUID?: string
	panelID?:      int
}

#NotificationSettings: {
	receiver: string
	groupBy?: [...string]
	groupWait?:      string
	groupInterval?:  string
	repeatInterval?: string
	muteTimeIntervals?: [...#MuteTimeIntervalRef]
	activeTimeIntervals?: [...#ActiveTimeIntervalRef]
}
