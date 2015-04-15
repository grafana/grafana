// Copyright 2013 by Dobrosław Żybort. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

package slug

import (
	"gopkgs.com/unidecode.v1"
	"regexp"
	"strings"
)

var (
	// Custom substitution map
	CustomSub map[string]string
	// Custom rune substitution map
	CustomRuneSub map[rune]string

	// Maximum slug length. It's smart so it will cat slug after full word.
	// By default slugs aren't shortened.
	// If MaxLength is smaller than length of the first word, then returned
	// slug will contain only substring from the first word truncated
	// after MaxLength.
	MaxLength int
)

//=============================================================================

// Make returns slug generated from provided string. Will use "en" as language
// substitution.
func Make(s string) (slug string) {
	return MakeLang(s, "en")
}

// MakeLang returns slug generated from provided string and will use provided
// language for chars substitution.
func MakeLang(s string, lang string) (slug string) {
	slug = strings.TrimSpace(s)

	// Custom substitutions
	// Always substitute runes first
	slug = SubstituteRune(slug, CustomRuneSub)
	slug = Substitute(slug, CustomSub)

	// Process string with selected substitution language
	switch lang {
	case "de":
		slug = SubstituteRune(slug, deSub)
	case "en":
		slug = SubstituteRune(slug, enSub)
	case "pl":
		slug = SubstituteRune(slug, plSub)
	case "es":
		slug = SubstituteRune(slug, esSub)
	default: // fallback to "en" if lang not found
		slug = SubstituteRune(slug, enSub)
	}

	slug = SubstituteRune(slug, defaultSub)

	// Process all non ASCII symbols
	slug = unidecode.Unidecode(slug)

	slug = strings.ToLower(slug)

	// Process all remaining symbols
	slug = regexp.MustCompile("[^a-z0-9-_]").ReplaceAllString(slug, "-")
	slug = regexp.MustCompile("-+").ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")

	if MaxLength > 0 {
		slug = smartTruncate(slug)
	}

	return slug
}

// Substitute returns string with superseded all substrings from
// provided substitution map.
func Substitute(s string, sub map[string]string) (buf string) {
	buf = s
	for key, val := range sub {
		buf = strings.Replace(s, key, val, -1)
	}
	return
}

// SubstituteRune substitutes string chars with provided rune
// substitution map.
func SubstituteRune(s string, sub map[rune]string) (buf string) {
	for _, c := range s {
		if d, ok := sub[c]; ok {
			buf += d
		} else {
			buf += string(c)
		}
	}
	return
}

func smartTruncate(text string) string {
	if len(text) < MaxLength {
		return text
	}

	var truncated string
	words := strings.SplitAfter(text, "-")
	// If MaxLength is smaller than length of the first word return word
	// truncated after MaxLength.
	if len(words[0]) > MaxLength {
		return words[0][:MaxLength]
	}
	for _, word := range words {
		if len(truncated)+len(word)-1 <= MaxLength {
			truncated = truncated + word
		} else {
			break
		}
	}
	return strings.Trim(truncated, "-")
}
