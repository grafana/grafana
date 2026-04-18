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

#NotificationSettingsType: "SimplifiedRouting" | "NamedRoutingTree"

#SimplifiedRouting: {
	// This is technically optional and there is a hack in the Makefile that
	// manually sets SimplifiedRouting as the default if type is absent

	type:     #NotificationSettingsType & "SimplifiedRouting"
	receiver: string
	groupBy?: [...string]
	groupWait?:      #PromDuration
	groupInterval?:  #PromDuration
	repeatInterval?: #PromDuration
	muteTimeIntervals?: [...#TimeIntervalRef]
	activeTimeIntervals?: [...#TimeIntervalRef]
}

#NamedRoutingTree: {
	type:        #NotificationSettingsType & "NamedRoutingTree"
	routingTree: string
}

// TODO(@moustafab): this should be imported from the notifications package
#NotificationSettings: #SimplifiedRouting | #NamedRoutingTree
