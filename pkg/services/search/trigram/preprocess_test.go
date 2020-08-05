package trigram_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/search/trigram"
	"github.com/stretchr/testify/assert"
)

func TestFromString(t *testing.T) {
	tests := map[string][]string{
		"":                {},
		"a":               {"a"},
		"123":             {"123"},
		"abcdef":          {"abc", "bcd", "cde", "def"},
		"sp ace":          {"spa", "pac", "ace"},
		"ABC":             {"abc"},
		"trygram's[sic]!": {"try", "ryg", "ygr", "gra", "ram", "ams", "mss", "ssi", "sic"},

		// Foreign characters,
		"ÅäÖ": {"åäö"},
		"那是最美好的時光，那是最糟糕的時光": {"那是最", "是最美", "最美好", "美好的", "好的時", "的時光", "時光那", "光那是", "那是最", "是最糟", "最糟糕", "糟糕的", "糕的時", "的時光"},

		// Example of query
		"avg_over_time(sensor_temperature_celsius[10m])": {"avg", "vgo", "gov", "ove", "ver", "ert", "rti", "tim", "ime", "mes", "ese", "sen", "ens", "nso", "sor", "ort", "rte", "tem", "emp", "mpe", "per", "era", "rat", "atu", "tur", "ure", "rec", "ece", "cel", "els", "lsi", "siu", "ius", "us1", "s10", "10m"},
	}
	for test, expected := range tests {
		tg := trigram.FromString(test)
		assert.EqualValues(t, expected, tg)
	}
}

func TestScore(t *testing.T) {
	tests := map[string]map[string]float64{
		"":            {},
		"foo":         {"foo": 1},
		"why why why": {"why": 2.357, "hyw": 1.642, "ywh": 1.5},
		"wwwwwwwwwww": {"www": 3},
	}
	for test, expectedScores := range tests {
		scores := trigram.Score(trigram.FromString(test))
		assert.Len(t, scores, len(expectedScores))

		for tg, expected := range expectedScores {
			score, exists := scores[tg]
			assert.Truef(t, exists, "expected trigram missing in scores: %s", tg)
			assert.InEpsilonf(t, expected, score, 0.01, "trigram: %s, expected: %f, got: %f", tg, expected, score)
		}
	}
}
