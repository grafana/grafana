package core

import (
	"testing"
)

func TestGonicMapperFromObj(t *testing.T) {
	testCases := map[string]string{
		"HTTPLib":             "http_lib",
		"id":                  "id",
		"ID":                  "id",
		"IDa":                 "i_da",
		"iDa":                 "i_da",
		"IDAa":                "id_aa",
		"aID":                 "a_id",
		"aaID":                "aa_id",
		"aaaID":               "aaa_id",
		"MyREalFunkYLONgNAME": "my_r_eal_funk_ylo_ng_name",
	}

	for in, expected := range testCases {
		out := gonicCasedName(in)
		if out != expected {
			t.Errorf("Given %s, expected %s but got %s", in, expected, out)
		}
	}
}

func TestGonicMapperToObj(t *testing.T) {
	testCases := map[string]string{
		"http_lib":                  "HTTPLib",
		"id":                        "ID",
		"ida":                       "Ida",
		"id_aa":                     "IDAa",
		"aa_id":                     "AaID",
		"my_r_eal_funk_ylo_ng_name": "MyREalFunkYloNgName",
	}

	for in, expected := range testCases {
		out := LintGonicMapper.Table2Obj(in)
		if out != expected {
			t.Errorf("Given %s, expected %s but got %s", in, expected, out)
		}
	}
}
