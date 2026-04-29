package v0alpha1

#Matcher: {
	type:  "=" | "!=" | "=~" | "!~" @cog(kind="enum",memberNames="Equal|NotEqual|EqualRegex|NotEqualRegex")
	label: string
	value: string
}

#Matchers: [...#Matcher]
