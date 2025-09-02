package v0alpha1

import "strings"

NoDataState:  *"NoData" | "Ok" | "Alerting" | "KeepLast"
ExecErrState: *"Error" | "Ok" | "Alerting" | "KeepLast"

#MuteTimeIntervalRef: string // TODO(@moustafab): validate regex for mute time interval ref

#ActiveTimeIntervalRef: string // TODO(@moustafab): validate regex for active time interval ref

// FIXME: the For and KeepFiringFor types should be using the AlertRulePromDuration type, but there seems to be an issue with the generator

AlertRuleSpec: #RuleSpec & {
	noDataState:                  NoDataState
	execErrState:                 ExecErrState
	"for"?:                       string & #PromDuration
	keepFiringFor?:               string & #PromDuration
	missingSeriesEvalsToResolve?: int & >=0
	notificationSettings?:        #NotificationSettings
	annotations?: {
		[string]: TemplateString
	}
	panelRef?: #PanelRef
}

#PanelRef: {
	dashboardUID: string & strings.MinRunes(1)
	panelID:      int & >0
}

// TODO(@moustafab): this should be imported from the notifications package
#NotificationSettings: {
	receiver: string
	groupBy?: [...string]
	groupWait?:      string
	groupInterval?:  string
	repeatInterval?: string
	muteTimeIntervals?: [...#MuteTimeIntervalRef]
	activeTimeIntervals?: [...#ActiveTimeIntervalRef]
}
