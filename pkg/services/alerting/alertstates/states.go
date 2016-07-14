package alertstates

var (
	ValidStates = []string{
		Ok,
		Warn,
		Critical,
		Unknown,
	}

	Ok       = "OK"
	Warn     = "WARN"
	Critical = "CRITICAL"
	Pending  = "PENDING"
	Unknown  = "UNKNOWN"
)
