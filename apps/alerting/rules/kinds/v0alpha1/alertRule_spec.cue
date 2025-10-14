package v0alpha1

import "strings"

NoDataState:  *"NoData" | "Ok" | "Alerting" | "KeepLast"
ExecErrState: *"Error" | "Ok" | "Alerting" | "KeepLast"

#TimeIntervalRef: string // TODO(@moustafab): validate regex for time interval ref

// FIXME: the For and KeepFiringFor types should be using the AlertRulePromDuration type, but there seems to be an issue with the generator

AlertRuleSpec: #RuleSpec & {
	annotations?: {
		[string]: TemplateString
	}
	"for"?:                       string & #PromDuration
	keepFiringFor?:               string & #PromDuration
	missingSeriesEvalsToResolve?: int & >=0
	noDataState:                  NoDataState
	execErrState:                 ExecErrState
	notificationSettings?:        #NotificationSettings
	panelRef?:                    #PanelRef
}

#PanelRef: {
	dashboardUID: string & strings.MinRunes(1) & =~"^[a-zA-Z0-9_-]+$"
	panelID:      int & >0
}

// TODO(@moustafab): this should be imported from the notifications package
#NotificationSettings: {
	receiver: string
	groupBy?: [...string]
	groupWait?:      #PromDuration
	groupInterval?:  #PromDuration
	repeatInterval?: #PromDuration
	muteTimeIntervals?: [...#TimeIntervalRef]
	activeTimeIntervals?: [...#TimeIntervalRef]
}
