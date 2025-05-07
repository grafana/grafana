package v0alpha1

TimeIntervalSpec: {
	name: string
	time_intervals: [...#Interval]
}

#TimeRange: {
	start_time: string
	end_time:   string
}
#Interval: {
	times?: [...#TimeRange]
	weekdays?: [...string]
	days_of_month?: [...string]
	months?: [...string]
	years?: [...string]
	location?: string
}
