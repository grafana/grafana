package simulator

import "strings"

// Maintains a list of actions taken per simulation to make debugging easier.
type ActivityLog struct {
	events []string
}

func NewActivityLog() *ActivityLog {
	return &ActivityLog{}
}

func (log *ActivityLog) Record(msg string) {
	log.events = append(log.events, msg)
}

func (log *ActivityLog) String() string {
	return strings.Join(log.events, "\n")
}
