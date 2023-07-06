/*
 * This file evolved from the MIT licensed: https://github.com/machiel/slugify
 */

/*

The MIT License (MIT)

Copyright (c) 2015 Machiel Molenaar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

package slugify

import (
	"bytes"
	"encoding/base64"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
)

var (
	simpleSlugger = &slugger{
		isValidCharacter: validCharacter,
		replaceCharacter: '-',
		replacementMap:   getDefaultReplacements(),
	}
)

// Slugify creates a URL safe latin slug for a given value
func Slugify(value string) string {
	s := simpleSlugger.Slugify(value)
	if s == "" {
		s = base64.RawURLEncoding.EncodeToString([]byte(value))
		if len(s) > 50 || s == "" {
			s = uuid.NewSHA1(uuid.NameSpaceOID, []byte(value)).String()
		}
	}
	return s
}

func validCharacter(c rune) bool {
	if c >= 'a' && c <= 'z' {
		return true
	}
	if c >= '0' && c <= '9' {
		return true
	}
	return false
}

// Slugifier based on settings
type slugger struct {
	isValidCharacter func(c rune) bool
	replaceCharacter rune
	replacementMap   map[rune]string
}

// Slugify creates a slug for a string
func (s slugger) Slugify(value string) string {
	value = strings.ToLower(value)
	var buffer bytes.Buffer
	lastCharacterWasInvalid := false

	for len(value) > 0 {
		c, size := utf8.DecodeRuneInString(value)
		value = value[size:]

		if newCharacter, ok := s.replacementMap[c]; ok {
			buffer.WriteString(newCharacter)
			lastCharacterWasInvalid = false
			continue
		}

		if s.isValidCharacter(c) {
			buffer.WriteRune(c)
			lastCharacterWasInvalid = false
		} else if !lastCharacterWasInvalid {
			buffer.WriteRune(s.replaceCharacter)
			lastCharacterWasInvalid = true
		}
	}

	return strings.Trim(buffer.String(), string(s.replaceCharacter))
}

func getDefaultReplacements() map[rune]string {
	return map[rune]string{
		'&': "and",
		'@': "at",
		'©': "c",
		'®': "r",
		'Æ': "ae",
		'ß': "ss",
		'à': "a",
		'á': "a",
		'â': "a",
		'ä': "a", // or "ae"
		'å': "a",
		'æ': "ae",
		'ç': "c",
		'è': "e",
		'é': "e",
		'ê': "e",
		'ë': "e",
		'ì': "i",
		'í': "i",
		'î': "i",
		'ï': "i",
		'ò': "o",
		'ó': "o",
		'ô': "o",
		'õ': "o",
		'ö': "o", // or "oe"?
		'ø': "o",
		'ù': "u",
		'ú': "u",
		'û': "u",
		'ü': "ue",
		'ý': "y",
		'þ': "p",
		'ÿ': "y",
		'ā': "a",
		'ă': "a",
		'Ą': "a",
		'ą': "a",
		'ć': "c",
		'ĉ': "c",
		'ċ': "c",
		'č': "c",
		'ď': "d",
		'đ': "d",
		'ē': "e",
		'ĕ': "e",
		'ė': "e",
		'ę': "e",
		'ě': "e",
		'ĝ': "g",
		'ğ': "g",
		'ġ': "g",
		'ģ': "g",
		'ĥ': "h",
		'ħ': "h",
		'ĩ': "i",
		'ī': "i",
		'ĭ': "i",
		'į': "i",
		'ı': "i",
		'ĳ': "ij",
		'ĵ': "j",
		'ķ': "k",
		'ĸ': "k",
		'Ĺ': "l",
		'ĺ': "l",
		'ļ': "l",
		'ľ': "l",
		'ŀ': "l",
		'ł': "l",
		'ń': "n",
		'ņ': "n",
		'ň': "n",
		'ŉ': "n",
		'ŋ': "n",
		'ō': "o",
		'ŏ': "o",
		'ő': "o",
		'Œ': "oe",
		'œ': "oe",
		'ŕ': "r",
		'ŗ': "r",
		'ř': "r",
		'ś': "s",
		'ŝ': "s",
		'ş': "s",
		'š': "s",
		'ţ': "t",
		'ť': "t",
		'ŧ': "t",
		'ũ': "u",
		'ū': "u",
		'ŭ': "u",
		'ů': "u",
		'ű': "u",
		'ų': "u",
		'ŵ': "w",
		'ŷ': "y",
		'ź': "z",
		'ż': "z",
		'ž': "z",
		'ſ': "z",
		'Ə': "e",
		'ƒ': "f",
		'Ơ': "o",
		'ơ': "o",
		'Ư': "u",
		'ư': "u",
		'ǎ': "a",
		'ǐ': "i",
		'ǒ': "o",
		'ǔ': "u",
		'ǖ': "u",
		'ǘ': "u",
		'ǚ': "u",
		'ǜ': "u",
		'ǻ': "a",
		'Ǽ': "ae",
		'ǽ': "ae",
		'Ǿ': "o",
		'ǿ': "o",
		'ə': "e",
		'Є': "e",
		'Б': "b",
		'Г': "g",
		'Д': "d",
		'Ж': "zh",
		'З': "z",
		'У': "u",
		'Ф': "f",
		'Х': "h",
		'Ц': "c",
		'Ч': "ch",
		'Ш': "sh",
		'Щ': "sch",
		'Ъ': "-",
		'Ы': "y",
		'Ь': "-",
		'Э': "je",
		'Ю': "ju",
		'Я': "ja",
		'а': "a",
		'б': "b",
		'в': "v",
		'г': "g",
		'д': "d",
		'е': "e",
		'ж': "zh",
		'з': "z",
		'и': "i",
		'й': "j",
		'к': "k",
		'л': "l",
		'м': "m",
		'н': "n",
		'о': "o",
		'п': "p",
		'р': "r",
		'с': "s",
		'т': "t",
		'у': "u",
		'ф': "f",
		'х': "h",
		'ц': "c",
		'ч': "ch",
		'ш': "sh",
		'щ': "sch",
		'ъ': "-",
		'ы': "y",
		'ь': "-",
		'э': "je",
		'ю': "ju",
		'я': "ja",
		'ё': "jo",
		'є': "e",
		'і': "i",
		'ї': "i",
		'Ґ': "g",
		'ґ': "g",
		'א': "a",
		'ב': "b",
		'ג': "g",
		'ד': "d",
		'ה': "h",
		'ו': "v",
		'ז': "z",
		'ח': "h",
		'ט': "t",
		'י': "i",
		'ך': "k",
		'כ': "k",
		'ל': "l",
		'ם': "m",
		'מ': "m",
		'ן': "n",
		'נ': "n",
		'ס': "s",
		'ע': "e",
		'ף': "p",
		'פ': "p",
		'ץ': "C",
		'צ': "c",
		'ק': "q",
		'ר': "r",
		'ש': "w",
		'ת': "t",
		'™': "tm",
		'ả': "a",
		'ã': "a",
		'ạ': "a",

		'ắ': "a",
		'ằ': "a",
		'ẳ': "a",
		'ẵ': "a",
		'ặ': "a",

		'ấ': "a",
		'ầ': "a",
		'ẩ': "a",
		'ẫ': "a",
		'ậ': "a",

		'ẻ': "e",
		'ẽ': "e",
		'ẹ': "e",
		'ế': "e",
		'ề': "e",
		'ể': "e",
		'ễ': "e",
		'ệ': "e",

		'ỉ': "i",
		'ị': "i",

		'ỏ': "o",
		'ọ': "o",
		'ố': "o",
		'ồ': "o",
		'ổ': "o",
		'ỗ': "o",
		'ộ': "o",
		'ớ': "o",
		'ờ': "o",
		'ở': "o",
		'ỡ': "o",
		'ợ': "o",

		'ủ': "u",
		'ụ': "u",
		'ứ': "u",
		'ừ': "u",
		'ử': "u",
		'ữ': "u",
		'ự': "u",

		'ỳ': "y",
		'ỷ': "y",
		'ỹ': "y",
		'ỵ': "y",
	}
}
