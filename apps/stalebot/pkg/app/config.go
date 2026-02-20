package app

// Config holds configuration for the stalebot app
type Config struct {
	// DefaultStaleDaysThreshold is the default number of days before a dashboard is considered stale
	DefaultStaleDaysThreshold int32

	// CheckIntervalMinutes is how often to check for stale dashboards
	CheckIntervalMinutes int

	// EnableNotifications determines if notifications should be sent for stale dashboards
	EnableNotifications bool
}
