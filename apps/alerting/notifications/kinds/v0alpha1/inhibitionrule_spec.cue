package v0alpha1

InhibitionRuleSpec: {
	// source_matchers define the alerts that act as inhibitors (silencing other alerts)
	source_matchers?: [...#Matcher]
	// target_matchers define the alerts that can be inhibited (silenced)
	target_matchers?: [...#Matcher]
	// equal specifies which labels must have equal values between source and target alerts
	// for the inhibition to take effect
	equal?: [...string]
}
