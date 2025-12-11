package crdt

import (
	"encoding/json"
)

// ORSet represents an Observed-Remove Set CRDT
type ORSet struct {
	adds    map[string]map[string]bool // element -> set of tags
	removes map[string]bool            // set of removed tags
}

// ORSetJSON is the JSON representation of ORSet
type ORSetJSON struct {
	Adds    map[string][]string `json:"adds"`
	Removes []string            `json:"removes"`
}

// NewORSet creates a new empty OR-Set
func NewORSet() *ORSet {
	return &ORSet{
		adds:    make(map[string]map[string]bool),
		removes: make(map[string]bool),
	}
}

// Add adds an element to the set with a unique tag
func (s *ORSet) Add(element, tag string) {
	if s.adds[element] == nil {
		s.adds[element] = make(map[string]bool)
	}
	s.adds[element][tag] = true
}

// Remove removes an element from the set
// Only removes the specific tags that were observed
func (s *ORSet) Remove(element string, observedTags []string) {
	for _, tag := range observedTags {
		s.removes[tag] = true
	}

	// Clean up the element's tags
	if elementTags, exists := s.adds[element]; exists {
		for _, tag := range observedTags {
			delete(elementTags, tag)
		}

		// If no tags remain, remove the element entry
		if len(elementTags) == 0 {
			delete(s.adds, element)
		}
	}
}

// Contains checks if an element is in the set
// Element is present if it has at least one non-removed tag
func (s *ORSet) Contains(element string) bool {
	tags, exists := s.adds[element]
	if !exists || len(tags) == 0 {
		return false
	}

	// Element is present if it has at least one tag that hasn't been removed
	for tag := range tags {
		if !s.removes[tag] {
			return true
		}
	}
	return false
}

// GetTags returns all tags for an element (including removed ones)
func (s *ORSet) GetTags(element string) []string {
	tags, exists := s.adds[element]
	if !exists {
		return []string{}
	}

	result := make([]string, 0, len(tags))
	for tag := range tags {
		result = append(result, tag)
	}
	return result
}

// Values returns all elements currently in the set
func (s *ORSet) Values() []string {
	result := make([]string, 0, len(s.adds))

	for element, tags := range s.adds {
		// Include element if it has at least one non-removed tag
		for tag := range tags {
			if !s.removes[tag] {
				result = append(result, element)
				break
			}
		}
	}

	return result
}

// Size returns the number of elements in the set
func (s *ORSet) Size() int {
	return len(s.Values())
}

// IsEmpty checks if the set is empty
func (s *ORSet) IsEmpty() bool {
	return s.Size() == 0
}

// Merge merges another OR-Set into this one
// Takes the union of all adds and removes
func (s *ORSet) Merge(other *ORSet) {
	// Merge adds (union of all tags)
	for element, otherTags := range other.adds {
		if s.adds[element] == nil {
			s.adds[element] = make(map[string]bool)
		}
		for tag := range otherTags {
			s.adds[element][tag] = true
		}
	}

	// Merge removes (union of all removed tags)
	for tag := range other.removes {
		s.removes[tag] = true
	}

	// Clean up elements with all tags removed
	for element, tags := range s.adds {
		hasLiveTag := false
		for tag := range tags {
			if !s.removes[tag] {
				hasLiveTag = true
				break
			}
		}
		if !hasLiveTag {
			delete(s.adds, element)
		}
	}
}

// Clone creates a deep copy of the OR-Set
func (s *ORSet) Clone() *ORSet {
	clone := NewORSet()

	// Deep copy adds
	for element, tags := range s.adds {
		clone.adds[element] = make(map[string]bool)
		for tag := range tags {
			clone.adds[element][tag] = true
		}
	}

	// Deep copy removes
	for tag := range s.removes {
		clone.removes[tag] = true
	}

	return clone
}

// Clear removes all elements from the set
func (s *ORSet) Clear() {
	s.adds = make(map[string]map[string]bool)
	s.removes = make(map[string]bool)
}

// MarshalJSON implements json.Marshaler
func (s *ORSet) MarshalJSON() ([]byte, error) {
	adds := make(map[string][]string)
	for element, tags := range s.adds {
		tagList := make([]string, 0, len(tags))
		for tag := range tags {
			tagList = append(tagList, tag)
		}
		adds[element] = tagList
	}

	removes := make([]string, 0, len(s.removes))
	for tag := range s.removes {
		removes = append(removes, tag)
	}

	return json.Marshal(ORSetJSON{
		Adds:    adds,
		Removes: removes,
	})
}

// UnmarshalJSON implements json.Unmarshaler
func (s *ORSet) UnmarshalJSON(data []byte) error {
	var tmp ORSetJSON
	if err := json.Unmarshal(data, &tmp); err != nil {
		return err
	}

	s.adds = make(map[string]map[string]bool)
	for element, tags := range tmp.Adds {
		s.adds[element] = make(map[string]bool)
		for _, tag := range tags {
			s.adds[element][tag] = true
		}
	}

	s.removes = make(map[string]bool)
	for _, tag := range tmp.Removes {
		s.removes[tag] = true
	}

	return nil
}
