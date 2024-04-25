package models

// Silence is the model-layer representation of an alertmanager silence.
type Silence struct { // TODO implement using matchers
	ID      *string
	RuleUID *string
}

func (s *Silence) GetRuleUID() *string {
	return s.RuleUID
}
