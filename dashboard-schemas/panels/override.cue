package panels

override: {
	matcher: {
		id:      string
		options: string
	}
	properties: [...{
		id:    string
		value: int
	}]
}
