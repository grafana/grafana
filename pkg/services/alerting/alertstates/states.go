package alertstates

var (
	ValidStates = []string{
		Ok,
		Warn,
		Critical,
		Acknowledged,
		Maintenance,
	}

	Ok           = "OK"
	Warn         = "WARN"
	Critical     = "CRITICAL"
	Acknowledged = "ACKNOWLEDGED"
	Maintenance  = "MAINTENANCE"
	Pending      = "PENDING"
)
