package remote

import (
	"crypto/md5"
	"errors"
	"fmt"
	"sort"
	"strings"
	"unicode"

	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/prometheus/model/labels"
)

// sanitizeLabelSet sanitizes all given LabelSet keys according to sanitizeLabelName.
// If there is a collision as a result of sanitization, a short (6 char) md5 hash of the original key will be added as a suffix.
func (am *Alertmanager) sanitizeLabelSet(lbls models.LabelSet) labels.Labels {
	ls := make(labels.Labels, 0, len(lbls))
	set := make(map[string]struct{})

	// Must sanitize labels in order otherwise resulting label set can be inconsistent when there are collisions.
	for _, k := range sortedKeys(lbls) {
		sanitizedLabelName, err := am.sanitizeLabelName(k)
		if err != nil {
			am.log.Error("Alert sending to the remote Alertmanager contains an invalid label/annotation name that failed to sanitize, skipping", "name", k, "error", err)
			continue
		}

		// There can be label name collisions after we sanitize. We check for this and attempt to make the name unique again using a short hash of the original name.
		if _, ok := set[sanitizedLabelName]; ok {
			sanitizedLabelName = sanitizedLabelName + fmt.Sprintf("_%.3x", md5.Sum([]byte(k)))
			am.log.Warn("Alert contains duplicate label/annotation name after sanitization, appending unique suffix", "name", k, "newName", sanitizedLabelName, "error", err)
		}

		set[sanitizedLabelName] = struct{}{}
		ls = append(ls, labels.Label{Name: sanitizedLabelName, Value: lbls[k]})
	}

	return ls
}

// sanitizeLabelName will fix a given label name so that it is compatible with prometheus alertmanager character restrictions.
// Prometheus alertmanager requires labels to match ^[a-zA-Z_][a-zA-Z0-9_]*$.
// Characters with an ASCII code < 127 will be replaced with an underscore (_), characters with ASCII code >= 127 will be replaced by their hex representation.
// For backwards compatibility, whitespace will be removed instead of replaced with an underscore.
func (am *Alertmanager) sanitizeLabelName(name string) (string, error) {
	if len(name) == 0 {
		return "", errors.New("label name cannot be empty")
	}

	if isValidLabelName(name) {
		return name, nil
	}

	am.log.Warn("Alert sending to the remote Alertmanager contains label/annotation name with invalid characters", "name", name)

	// Remove spaces. We do this instead of replacing with underscore for backwards compatibility as this existed before the rest of this function.
	sanitized := strings.Join(strings.Fields(name), "")

	// Replace other invalid characters.
	var buf strings.Builder
	for i, b := range sanitized {
		if isValidCharacter(i, b) {
			buf.WriteRune(b)
			continue
		}

		if b <= unicode.MaxASCII {
			buf.WriteRune('_')
			continue
		}

		if i == 0 {
			buf.WriteRune('_')
		}
		_, _ = fmt.Fprintf(&buf, "%#x", b)
	}

	if buf.Len() == 0 {
		return "", fmt.Errorf("label name is empty after removing invalids chars")
	}

	return buf.String(), nil
}

// isValidLabelName is true iff the label name matches the pattern of ^[a-zA-Z_][a-zA-Z0-9_]*$.
func isValidLabelName(ln string) bool {
	if len(ln) == 0 {
		return false
	}
	for i, b := range ln {
		if !isValidCharacter(i, b) {
			return false
		}
	}
	return true
}

// isValidCharacter checks if a specific rune is allowed at the given position in a label key for an external Prometheus alertmanager.
// From alertmanager LabelName.IsValid().
func isValidCharacter(pos int, b rune) bool {
	return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || b == '_' || (b >= '0' && b <= '9' && pos > 0)
}

func sortedKeys(m map[string]string) []string {
	orderedKeys := make([]string, len(m))
	i := 0
	for k := range m {
		orderedKeys[i] = k
		i++
	}
	sort.Strings(orderedKeys)
	return orderedKeys
}

func labelsToOpenAPILabelSet(modelLabelSet labels.Labels) models.LabelSet {
	apiLabelSet := models.LabelSet{}
	modelLabelSet.Range(func(label labels.Label) {
		apiLabelSet[label.Name] = label.Value
	})

	return apiLabelSet
}
