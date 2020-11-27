package panels

_thresholds: {
	// Threshold mode.
	mode: string | *"absolute"
	// Threshold steps.
	steps: [...{
		color: string
		value: number
	}]
}
