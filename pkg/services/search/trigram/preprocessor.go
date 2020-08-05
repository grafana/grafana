package trigram

import (
	"strings"
	"unicode"
)

func FromString(input string) []string {
	uncased := strings.ToLower(input)
	trimmed := removeSpecialChars(uncased)

	trigrams := []string{}
	for open := range trimmed {
		end := open + 3
		if end > len(trimmed) {
			end = len(trimmed)
		}

		gram := trimmed[open:end]

		if len(trigrams) > 0 && len(gram) < 3 {
			// end of word
			break
		}

		trigrams = append(trigrams, string(gram))
	}

	return trigrams
}

func removeSpecialChars(input string) []rune {
	output := make([]rune, 0, len(input))
	for _, c := range input {
		if shouldRemove(c) {
			continue
		}
		output = append(output, c)
	}
	return output
}

func shouldRemove(c rune) bool {
	rangeTables := []*unicode.RangeTable{
		unicode.White_Space,
		unicode.Punct,
	}

	for _, table := range rangeTables {
		if unicode.Is(table, c) {
			return true
		}
	}
	return false
}

// Score takes a slice of trigrams and produces a scoring of the
// relative importance of the slice's individual trigrams.
// The result is a map trigrams->score, where score is a floating
// point value between 0.5 and 3.
func Score(trigrams []string) map[string]float64 {
	scores := map[string]float64{}

	for i, gram := range trigrams {
		// starting at a multiplier of 1 and moving down to a multiplier
		// of 0.5 to make the weight of a trigram lower at the end of a
		// list than in the beginning. capping out at a total of 3 to
		// not give unfair advantage to longer strings.
		score := 1. - float64(i)/float64(2*len(trigrams))

		if prevScore, exists := scores[gram]; exists {
			score = score + prevScore
			if score > 3 {
				score = 3
			}
		}

		scores[gram] = score
	}

	return scores
}
