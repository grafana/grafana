package v1beta1

#Matcher: {
	type:  "=" | "!=" | "=~" | "!~" @cuetsy(kind="enum",memberNames="Equal|NotEqual|EqualRegex|NotEqualRegex")
	label: string
	value: string
}
