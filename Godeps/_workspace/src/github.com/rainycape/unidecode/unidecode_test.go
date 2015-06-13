package unidecode

import (
	"testing"
)

func testTransliteration(original string, decoded string, t *testing.T) {
	if r := Unidecode(original); r != decoded {
		t.Errorf("Expected '%s', got '%s'\n", decoded, r)
	}
}

func TestASCII(t *testing.T) {
	s := "ABCDEF"
	testTransliteration(s, s, t)
}

func TestKnosos(t *testing.T) {
	o := "Κνωσός"
	d := "Knosos"
	testTransliteration(o, d, t)
}

func TestBeiJing(t *testing.T) {
	o := "\u5317\u4EB0"
	d := "Bei Jing "
	testTransliteration(o, d, t)
}

func TestEmoji(t *testing.T) {
	o := "Hey Luna t belle 😵😂"
	d := "Hey Luna t belle "
	testTransliteration(o, d, t)
}

func BenchmarkUnidecode(b *testing.B) {
	cases := []string{
		"ABCDEF",
		"Κνωσός",
		"\u5317\u4EB0",
	}
	for ii := 0; ii < b.N; ii++ {
		for _, v := range cases {
			_ = Unidecode(v)
		}
	}
}

func BenchmarkDecodeTable(b *testing.B) {
	for ii := 0; ii < b.N; ii++ {
		decodeTransliterations()
	}
}

func init() {
	decodeTransliterations()
}
