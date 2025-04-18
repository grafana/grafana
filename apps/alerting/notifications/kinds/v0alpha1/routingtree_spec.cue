package v0alpha1

RouteTreeSpec: {
	defaults: #RouteDefaults
	routes: [...#Route]
}

#RouteDefaults: {
	receiver: string
	group_by?: [...string]
	group_wait?:      string
	group_interval?:  string
	repeat_interval?: string
}

#Matcher: {
	type:  "=" | "!=" | "=~" | "!~" @cuetsy(kind="enum",memberNames="Equal|NotEqual|EqualRegex|NotEqualRegex")
	label: string
	value: string
}

#Route: {
	receiver?: string
	matchers?: [...#Matcher]
	continue: bool

	group_by?: [...string]
	mute_time_intervals?: [...string]
	routes?: [...#Route]
	group_wait?:      string
	group_interval?:  string
	repeat_interval?: string
}
