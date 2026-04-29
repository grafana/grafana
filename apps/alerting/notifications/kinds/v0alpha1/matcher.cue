package v0alpha1

#Matcher: {
	type:  "=" | "!=" | "=~" | "!~" @cuetsy(kind="enum",memberNames="Equal|NotEqual|EqualRegex|NotEqualRegex")
	label: string
	value: string
}
