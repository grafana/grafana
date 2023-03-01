package exemplar

import "sort"

var _ LabelTracker = (*labelTracker)(nil)

type LabelTracker interface {
	Add(labels map[string]string)
	GetNames() []string
}

type labelTracker struct {
	labelSet map[string]struct{}
}

func NewLabelTracker() LabelTracker {
	return &labelTracker{
		labelSet: map[string]struct{}{},
	}
}

// Add saves label names that haven't been seen before
// so that they can be used to build the label fields in the exemplar frame
func (l *labelTracker) Add(labels map[string]string) {
	for k := range labels {
		if _, ok := l.labelSet[k]; !ok {
			l.labelSet[k] = struct{}{}
		}
	}
}

// GetNames returns sorted unique label names
func (l *labelTracker) GetNames() []string {
	labelNames := make([]string, 0, len(l.labelSet))
	for k := range l.labelSet {
		labelNames = append(labelNames, k)
	}
	sort.SliceStable(labelNames, func(i, j int) bool {
		return labelNames[i] < labelNames[j]
	})
	return labelNames
}
