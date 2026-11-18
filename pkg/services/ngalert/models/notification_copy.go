package models

// CopyContactPointRouting creates a deep copy of ContactPointRouting.
func CopyContactPointRouting(ns ContactPointRouting) ContactPointRouting {
	c := ContactPointRouting{
		Receiver: ns.Receiver,
	}
	if ns.GroupWait != nil {
		c.GroupWait = new(*ns.GroupWait)
	}
	if ns.GroupInterval != nil {
		c.GroupInterval = new(*ns.GroupInterval)
	}
	if ns.RepeatInterval != nil {
		c.RepeatInterval = new(*ns.RepeatInterval)
	}
	if ns.GroupBy != nil {
		c.GroupBy = make([]string, len(ns.GroupBy))
		copy(c.GroupBy, ns.GroupBy)
	}
	if ns.MuteTimeIntervals != nil {
		c.MuteTimeIntervals = make([]string, len(ns.MuteTimeIntervals))
		copy(c.MuteTimeIntervals, ns.MuteTimeIntervals)
	}
	if ns.ActiveTimeIntervals != nil {
		c.ActiveTimeIntervals = make([]string, len(ns.ActiveTimeIntervals))
		copy(c.ActiveTimeIntervals, ns.ActiveTimeIntervals)
	}
	return c
}

// CopyNotificationSettings creates a deep copy of NotificationSettings.
func CopyNotificationSettings(ns NotificationSettings) NotificationSettings {
	c := NotificationSettings{}
	if ns.ContactPointRouting != nil {
		c.ContactPointRouting = new(CopyContactPointRouting(*ns.ContactPointRouting))
	}
	if ns.PolicyRouting != nil {
		c.PolicyRouting = &PolicyRouting{Policy: ns.PolicyRouting.Policy}
	}
	return c
}
