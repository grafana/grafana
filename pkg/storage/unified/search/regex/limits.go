package regex

import "fmt"

const (
	MaxDictionaryTerms = 10_000
	MaxExpandedTerms   = 10_000
)

// ExpansionBudget bounds one dictionary enumeration. Value and existence queries
// each get their own budget, as do shards and authorization windows.
type ExpansionBudget struct {
	Field     string
	inspected int
	expanded  int
}

// Observe charges a dictionary term and, when matched, its expansion. Expansion
// errors take precedence when the same term exceeds both limits.
func (b *ExpansionBudget) Observe(matched bool) error {
	b.inspected++
	if matched {
		b.expanded++
		if b.expanded > MaxExpandedTerms {
			return &LimitError{Field: b.Field, Kind: ExpansionLimit}
		}
	}
	if b.inspected > MaxDictionaryTerms {
		return &LimitError{Field: b.Field, Kind: DictionaryLimit}
	}
	return nil
}

type LimitKind uint8

const (
	ExpansionLimit LimitKind = iota
	DictionaryLimit
)

type LimitError struct {
	Field string
	Kind  LimitKind
}

func (e *LimitError) Error() string {
	if e.Kind == DictionaryLimit {
		return fmt.Sprintf("regular expression on field %q exceeds the %d-term dictionary scan limit", e.Field, MaxDictionaryTerms)
	}
	return fmt.Sprintf("regular expression on field %q exceeds the %d-term expansion limit", e.Field, MaxExpandedTerms)
}
