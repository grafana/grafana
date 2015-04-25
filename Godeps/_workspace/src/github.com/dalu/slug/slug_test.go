// Copyright 2013 by Dobrosław Żybort. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

package slug

import (
	"testing"
)

//=============================================================================

func TestSlugMake(t *testing.T) {
	var testCases = []struct {
		in   string
		want string
	}{
		{"DOBROSLAWZYBORT", "dobroslawzybort"},
		{"Dobroslaw Zybort", "dobroslaw-zybort"},
		{"  Dobroslaw     Zybort  ?", "dobroslaw-zybort"},
		{"Dobrosław Żybort", "dobroslaw-zybort"},
		{"Ala ma 6 kotów.", "ala-ma-6-kotow"},

		{"áÁàÀãÃâÂäÄąĄą̊Ą̊", "aaaaaaaaaaaaaa"},
		{"ćĆĉĈçÇ", "cccccc"},
		{"éÉèÈẽẼêÊëËęĘ", "eeeeeeeeeeee"},
		{"íÍìÌĩĨîÎïÏįĮ", "iiiiiiiiiiii"},
		{"łŁ", "ll"},
		{"ńŃ", "nn"},
		{"óÓòÒõÕôÔöÖǫǪǭǬø", "ooooooooooooooo"},
		{"śŚ", "ss"},
		{"úÚùÙũŨûÛüÜųŲ", "uuuuuuuuuuuu"},
		{"y̨Y̨", "yy"},
		{"źŹżŹ", "zzzz"},
		{"·/,:;`˜'\"", ""},
		{"2000–2013", "2000-2013"},
		{"style—not", "style-not"},
		{"test_slug", "test_slug"},
		{"Æ", "ae"},
		{"Ich heiße", "ich-heisse"},

		{"This & that", "this-and-that"},
		{"fácil €", "facil-eu"},
		{"smile ☺", "smile"},
		{"Hellö Wörld хелло ворлд", "hello-world-khello-vorld"},
		{"\"C'est déjà l’été.\"", "cest-deja-lete"},
		{"jaja---lol-méméméoo--a", "jaja-lol-mememeoo-a"},
		{"影師", "ying-shi"},
	}

	for index, st := range testCases {
		got := Make(st.in)
		if got != st.want {
			t.Errorf(
				"%d. Make(%#v) = %#v; want %#v",
				index, st.in, got, st.want)
		}
	}
}

func TestSlugMakeLang(t *testing.T) {
	var testCases = []struct {
		lang string
		in   string
		want string
	}{
		{"en", "This & that", "this-and-that"},
		{"de", "This & that", "this-und-that"},
		{"pl", "This & that", "this-i-that"},
		{"es", "This & that", "this-y-that"},
		{"test", "This & that", "this-and-that"}, // unknown lang, fallback to "en"
	}

	for index, smlt := range testCases {
		got := MakeLang(smlt.in, smlt.lang)
		if got != smlt.want {
			t.Errorf(
				"%d. MakeLang(%#v, %#v) = %#v; want %#v",
				index, smlt.in, smlt.lang, got, smlt.want)
		}
	}
}

func TestSlugMakeUserSubstituteLang(t *testing.T) {
	var testCases = []struct {
		cSub map[string]string
		lang string
		in   string
		want string
	}{
		{map[string]string{"'": " "}, "en", "That's great", "that-s-great"},
		{map[string]string{"&": "or"}, "en", "This & that", "this-or-that"}, // by default "&" => "and"
		{map[string]string{"&": "or"}, "de", "This & that", "this-or-that"}, // by default "&" => "und"
	}

	for index, smust := range testCases {
		CustomSub = smust.cSub
		got := MakeLang(smust.in, smust.lang)
		if got != smust.want {
			t.Errorf(
				"%d. %#v; MakeLang(%#v, %#v) = %#v; want %#v",
				index, smust.cSub, smust.in, smust.lang,
				got, smust.want)

		}
	}
}

func TestSlugMakeSubstituteOrderLang(t *testing.T) {
	// Always substitute runes first
	var testCases = []struct {
		rSub map[rune]string
		sSub map[string]string
		in   string
		want string
	}{
		{map[rune]string{'o': "left"}, map[string]string{"o": "right"}, "o o", "left-left"},
		{map[rune]string{'&': "down"}, map[string]string{"&": "up"}, "&", "down"},
	}

	for index, smsot := range testCases {
		CustomRuneSub = smsot.rSub
		CustomSub = smsot.sSub
		got := Make(smsot.in)
		if got != smsot.want {
			t.Errorf(
				"%d. %#v; %#v; Make(%#v) = %#v; want %#v",
				index, smsot.rSub, smsot.sSub, smsot.in,
				got, smsot.want)

		}
	}
}

func TestSubstituteLang(t *testing.T) {
	var testCases = []struct {
		cSub map[string]string
		in   string
		want string
	}{
		{map[string]string{"o": "no"}, "o o o", "no no no"},
		{map[string]string{"'": " "}, "That's great", "That s great"},
	}

	for index, sst := range testCases {
		got := Substitute(sst.in, sst.cSub)
		if got != sst.want {
			t.Errorf(
				"%d. Substitute(%#v, %#v) = %#v; want %#v",
				index, sst.in, sst.cSub, got, sst.want)
		}
	}
}

func TestSubstituteRuneLang(t *testing.T) {
	var testCases = []struct {
		cSub map[rune]string
		in   string
		want string
	}{
		{map[rune]string{'o': "no"}, "o o o", "no no no"},
		{map[rune]string{'\'': " "}, "That's great", "That s great"},
	}

	for index, ssrt := range testCases {
		got := SubstituteRune(ssrt.in, ssrt.cSub)
		if got != ssrt.want {
			t.Errorf(
				"%d. SubstituteRune(%#v, %#v) = %#v; want %#v",
				index, ssrt.in, ssrt.cSub, got, ssrt.want)
		}
	}
}

func TestSlugMakeSmartTruncate(t *testing.T) {
	var testCases = []struct {
		in        string
		maxLength int
		want      string
	}{
		{"DOBROSLAWZYBORT", 100, "dobroslawzybort"},
		{"Dobroslaw Zybort", 100, "dobroslaw-zybort"},
		{"Dobroslaw Zybort", 12, "dobroslaw"},
		{"  Dobroslaw     Zybort  ?", 12, "dobroslaw"},
		{"Ala ma 6 kotów.", 10, "ala-ma-6"},
		{"Dobrosław Żybort", 5, "dobro"},
	}

	for index, smstt := range testCases {
		MaxLength = smstt.maxLength
		got := Make(smstt.in)
		if got != smstt.want {
			t.Errorf(
				"%d. MaxLength = %v; Make(%#v) = %#v; want %#v",
				index, smstt.maxLength, smstt.in, got, smstt.want)
		}
	}
}

func BenchmarkMakeShortAscii(b *testing.B) {
	b.ReportAllocs()
	for n := 0; n < b.N; n++ {
		Make("Hello world")
	}
}
func BenchmarkMakeShort(b *testing.B) {
	b.ReportAllocs()
	for n := 0; n < b.N; n++ {
		Make("хелло ворлд")
	}
}

func BenchmarkMakeShortSymbols(b *testing.B) {
	b.ReportAllocs()
	for n := 0; n < b.N; n++ {
		Make("·/,:;`˜'\" &€￡￥")
	}
}

func BenchmarkMakeMediumAscii(b *testing.B) {
	b.ReportAllocs()
	for n := 0; n < b.N; n++ {
		Make("ABCDE FGHIJ KLMNO PQRST UWXYZ ABCDE FGHIJ KLMNO PQRST UWXYZ ABCDE")
	}
}

func BenchmarkMakeMedium(b *testing.B) {
	b.ReportAllocs()
	for n := 0; n < b.N; n++ {
		Make("ｦｧｨｩｪ ｫｬｭｮｯ ｰｱｲｳｴ ｵｶｷｸｹ ｺｻｼｽｾ ｿﾀﾁﾂﾃ ﾄﾅﾆﾇﾈ ﾉﾊﾋﾌﾍ ﾎﾏﾐﾑﾒ ﾓﾔﾕﾖﾗ ﾘﾙﾚﾛﾜ")
	}
}

func BenchmarkMakeLongAscii(b *testing.B) {
	longStr := "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi " +
		"pulvinar sodales ultrices. Nulla facilisi. Sed at vestibulum erat. Ut " +
		"sit amet urna posuere, sagittis eros ac, varius nisi. Morbi ullamcorper " +
		"odio at nunc pulvinar mattis. Vestibulum rutrum, ante eu dictum mattis, " +
		"elit risus finibus nunc, consectetur facilisis eros leo ut sapien. Sed " +
		"pulvinar volutpat mi. Cras semper mi ac eros accumsan, at feugiat massa " +
		"elementum. Morbi eget dolor sit amet purus condimentum egestas non ut " +
		"sapien. Duis feugiat magna vitae nisi lobortis, quis finibus sem " +
		"sollicitudin. Pellentesque eleifend blandit ipsum, ut porta arcu " +
		"ultricies et. Fusce vel ipsum porta, placerat diam ac, consectetur " +
		"magna. Nulla in porta sem. Suspendisse commodo, felis in molestie " +
		"ultricies, arcu ipsum aliquet turpis, elementum dapibus ipsum lorem a " +
		"nisl. Etiam varius imperdiet placerat. Aliquam euismod lacus arcu, " +
		"ultrices hendrerit est pellentesque vel. Aliquam sit amet laoreet leo. " +
		"Integer eros libero, mollis sed posuere."

	b.ReportAllocs()
	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		Make(longStr)
	}
}

func BenchmarkSubstituteRuneShort(b *testing.B) {
	shortStr := "Hello/Hi world"
	subs := map[rune]string{'o': "no", '/': "slash"}

	b.ReportAllocs()
	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		SubstituteRune(shortStr, subs)
	}
}

func BenchmarkSubstituteRuneLong(b *testing.B) {
	longStr := "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi " +
		"pulvinar sodales ultrices. Nulla facilisi. Sed at vestibulum erat. Ut " +
		"sit amet urna posuere, sagittis eros ac, varius nisi. Morbi ullamcorper " +
		"odio at nunc pulvinar mattis. Vestibulum rutrum, ante eu dictum mattis, " +
		"elit risus finibus nunc, consectetur facilisis eros leo ut sapien. Sed " +
		"pulvinar volutpat mi. Cras semper mi ac eros accumsan, at feugiat massa " +
		"elementum. Morbi eget dolor sit amet purus condimentum egestas non ut " +
		"sapien. Duis feugiat magna vitae nisi lobortis, quis finibus sem " +
		"sollicitudin. Pellentesque eleifend blandit ipsum, ut porta arcu " +
		"ultricies et. Fusce vel ipsum porta, placerat diam ac, consectetur " +
		"magna. Nulla in porta sem. Suspendisse commodo, felis in molestie " +
		"ultricies, arcu ipsum aliquet turpis, elementum dapibus ipsum lorem a " +
		"nisl. Etiam varius imperdiet placerat. Aliquam euismod lacus arcu, " +
		"ultrices hendrerit est pellentesque vel. Aliquam sit amet laoreet leo. " +
		"Integer eros libero, mollis sed posuere."
	subs := map[rune]string{
		'o': "no",
		'/': "slash",
		'i': "done",
		'E': "es",
		'a': "ASD",
		'1': "one",
		'l': "onetwo",
	}

	b.ReportAllocs()
	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		SubstituteRune(longStr, subs)
	}
}

func BenchmarkSmartTruncateShort(b *testing.B) {
	shortStr := "Hello-world"
	MaxLength = 8

	b.ReportAllocs()
	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		smartTruncate(shortStr)
	}
}

func BenchmarkSmartTruncateLong(b *testing.B) {
	longStr := "Lorem-ipsum-dolor-sit-amet,-consectetur-adipiscing-elit.-Morbi-" +
		"pulvinar-sodales-ultrices.-Nulla-facilisi.-Sed-at-vestibulum-erat.-Ut-" +
		"sit-amet-urna-posuere,-sagittis-eros-ac,-varius-nisi.-Morbi-ullamcorper-" +
		"odio-at-nunc-pulvinar-mattis.-Vestibulum-rutrum,-ante-eu-dictum-mattis,-" +
		"elit-risus-finibus-nunc,-consectetur-facilisis-eros-leo-ut-sapien.-Sed-" +
		"pulvinar-volutpat-mi.-Cras-semper-mi-ac-eros-accumsan,-at-feugiat-massa-" +
		"elementum.-Morbi-eget-dolor-sit-amet-purus-condimentum-egestas-non-ut-" +
		"sapien.-Duis-feugiat-magna-vitae-nisi-lobortis,-quis-finibus-sem-" +
		"sollicitudin.-Pellentesque-eleifend-blandit-ipsum,-ut-porta-arcu-" +
		"ultricies-et.-Fusce-vel-ipsum-porta,-placerat-diam-ac,-consectetur-" +
		"magna.-Nulla-in-porta-sem.-Suspendisse-commodo,-felis-in-molestie-" +
		"ultricies,-arcu-ipsum-aliquet-turpis,-elementum-dapibus-ipsum-lorem-a-" +
		"nisl.-Etiam-varius-imperdiet-placerat.-Aliquam-euismod-lacus-arcu,-" +
		"ultrices-hendrerit-est-pellentesque-vel.-Aliquam-sit-amet-laoreet-leo.-" +
		"Integer-eros-libero,-mollis-sed-posuere."
	MaxLength = 256

	b.ReportAllocs()
	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		smartTruncate(longStr)
	}
}
