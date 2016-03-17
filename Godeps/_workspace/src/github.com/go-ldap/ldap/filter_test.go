package ldap_test

import (
	"strings"
	"testing"

	"gopkg.in/asn1-ber.v1"
	"gopkg.in/ldap.v2"
)

type compileTest struct {
	filterStr string

	expectedFilter string
	expectedType   int
	expectedErr    string
}

var testFilters = []compileTest{
	compileTest{
		filterStr:      "(&(sn=Miller)(givenName=Bob))",
		expectedFilter: "(&(sn=Miller)(givenName=Bob))",
		expectedType:   ldap.FilterAnd,
	},
	compileTest{
		filterStr:      "(|(sn=Miller)(givenName=Bob))",
		expectedFilter: "(|(sn=Miller)(givenName=Bob))",
		expectedType:   ldap.FilterOr,
	},
	compileTest{
		filterStr:      "(!(sn=Miller))",
		expectedFilter: "(!(sn=Miller))",
		expectedType:   ldap.FilterNot,
	},
	compileTest{
		filterStr:      "(sn=Miller)",
		expectedFilter: "(sn=Miller)",
		expectedType:   ldap.FilterEqualityMatch,
	},
	compileTest{
		filterStr:      "(sn=Mill*)",
		expectedFilter: "(sn=Mill*)",
		expectedType:   ldap.FilterSubstrings,
	},
	compileTest{
		filterStr:      "(sn=*Mill)",
		expectedFilter: "(sn=*Mill)",
		expectedType:   ldap.FilterSubstrings,
	},
	compileTest{
		filterStr:      "(sn=*Mill*)",
		expectedFilter: "(sn=*Mill*)",
		expectedType:   ldap.FilterSubstrings,
	},
	compileTest{
		filterStr:      "(sn=*i*le*)",
		expectedFilter: "(sn=*i*le*)",
		expectedType:   ldap.FilterSubstrings,
	},
	compileTest{
		filterStr:      "(sn=Mi*l*r)",
		expectedFilter: "(sn=Mi*l*r)",
		expectedType:   ldap.FilterSubstrings,
	},
	// substring filters escape properly
	compileTest{
		filterStr:      `(sn=Mi*함*r)`,
		expectedFilter: `(sn=Mi*\ed\95\a8*r)`,
		expectedType:   ldap.FilterSubstrings,
	},
	// already escaped substring filters don't get double-escaped
	compileTest{
		filterStr:      `(sn=Mi*\ed\95\a8*r)`,
		expectedFilter: `(sn=Mi*\ed\95\a8*r)`,
		expectedType:   ldap.FilterSubstrings,
	},
	compileTest{
		filterStr:      "(sn=Mi*le*)",
		expectedFilter: "(sn=Mi*le*)",
		expectedType:   ldap.FilterSubstrings,
	},
	compileTest{
		filterStr:      "(sn=*i*ler)",
		expectedFilter: "(sn=*i*ler)",
		expectedType:   ldap.FilterSubstrings,
	},
	compileTest{
		filterStr:      "(sn>=Miller)",
		expectedFilter: "(sn>=Miller)",
		expectedType:   ldap.FilterGreaterOrEqual,
	},
	compileTest{
		filterStr:      "(sn<=Miller)",
		expectedFilter: "(sn<=Miller)",
		expectedType:   ldap.FilterLessOrEqual,
	},
	compileTest{
		filterStr:      "(sn=*)",
		expectedFilter: "(sn=*)",
		expectedType:   ldap.FilterPresent,
	},
	compileTest{
		filterStr:      "(sn~=Miller)",
		expectedFilter: "(sn~=Miller)",
		expectedType:   ldap.FilterApproxMatch,
	},
	compileTest{
		filterStr:      `(objectGUID='\fc\fe\a3\ab\f9\90N\aaGm\d5I~\d12)`,
		expectedFilter: `(objectGUID='\fc\fe\a3\ab\f9\90N\aaGm\d5I~\d12)`,
		expectedType:   ldap.FilterEqualityMatch,
	},
	compileTest{
		filterStr:      `(objectGUID=абвгдеёжзийклмнопрстуфхцчшщъыьэюя)`,
		expectedFilter: `(objectGUID=\d0\b0\d0\b1\d0\b2\d0\b3\d0\b4\d0\b5\d1\91\d0\b6\d0\b7\d0\b8\d0\b9\d0\ba\d0\bb\d0\bc\d0\bd\d0\be\d0\bf\d1\80\d1\81\d1\82\d1\83\d1\84\d1\85\d1\86\d1\87\d1\88\d1\89\d1\8a\d1\8b\d1\8c\d1\8d\d1\8e\d1\8f)`,
		expectedType:   ldap.FilterEqualityMatch,
	},
	compileTest{
		filterStr:      `(objectGUID=함수목록)`,
		expectedFilter: `(objectGUID=\ed\95\a8\ec\88\98\eb\aa\a9\eb\a1\9d)`,
		expectedType:   ldap.FilterEqualityMatch,
	},
	compileTest{
		filterStr:      `(objectGUID=`,
		expectedFilter: ``,
		expectedType:   0,
		expectedErr:    "unexpected end of filter",
	},
	compileTest{
		filterStr:      `(objectGUID=함수목록`,
		expectedFilter: ``,
		expectedType:   0,
		expectedErr:    "unexpected end of filter",
	},
	compileTest{
		filterStr:      `(&(objectclass=inetorgperson)(cn=中文))`,
		expectedFilter: `(&(objectclass=inetorgperson)(cn=\e4\b8\ad\e6\96\87))`,
		expectedType:   0,
	},
	// attr extension
	compileTest{
		filterStr:      `(memberOf:=foo)`,
		expectedFilter: `(memberOf:=foo)`,
		expectedType:   ldap.FilterExtensibleMatch,
	},
	// attr+named matching rule extension
	compileTest{
		filterStr:      `(memberOf:test:=foo)`,
		expectedFilter: `(memberOf:test:=foo)`,
		expectedType:   ldap.FilterExtensibleMatch,
	},
	// attr+oid matching rule extension
	compileTest{
		filterStr:      `(cn:1.2.3.4.5:=Fred Flintstone)`,
		expectedFilter: `(cn:1.2.3.4.5:=Fred Flintstone)`,
		expectedType:   ldap.FilterExtensibleMatch,
	},
	// attr+dn+oid matching rule extension
	compileTest{
		filterStr:      `(sn:dn:2.4.6.8.10:=Barney Rubble)`,
		expectedFilter: `(sn:dn:2.4.6.8.10:=Barney Rubble)`,
		expectedType:   ldap.FilterExtensibleMatch,
	},
	// attr+dn extension
	compileTest{
		filterStr:      `(o:dn:=Ace Industry)`,
		expectedFilter: `(o:dn:=Ace Industry)`,
		expectedType:   ldap.FilterExtensibleMatch,
	},
	// dn extension
	compileTest{
		filterStr:      `(:dn:2.4.6.8.10:=Dino)`,
		expectedFilter: `(:dn:2.4.6.8.10:=Dino)`,
		expectedType:   ldap.FilterExtensibleMatch,
	},
	compileTest{
		filterStr:      `(memberOf:1.2.840.113556.1.4.1941:=CN=User1,OU=blah,DC=mydomain,DC=net)`,
		expectedFilter: `(memberOf:1.2.840.113556.1.4.1941:=CN=User1,OU=blah,DC=mydomain,DC=net)`,
		expectedType:   ldap.FilterExtensibleMatch,
	},

	// compileTest{ filterStr: "()", filterType: FilterExtensibleMatch },
}

var testInvalidFilters = []string{
	`(objectGUID=\zz)`,
	`(objectGUID=\a)`,
}

func TestFilter(t *testing.T) {
	// Test Compiler and Decompiler
	for _, i := range testFilters {
		filter, err := ldap.CompileFilter(i.filterStr)
		if err != nil {
			if i.expectedErr == "" || !strings.Contains(err.Error(), i.expectedErr) {
				t.Errorf("Problem compiling '%s' - '%v' (expected error to contain '%v')", i.filterStr, err, i.expectedErr)
			}
		} else if filter.Tag != ber.Tag(i.expectedType) {
			t.Errorf("%q Expected %q got %q", i.filterStr, ldap.FilterMap[uint64(i.expectedType)], ldap.FilterMap[uint64(filter.Tag)])
		} else {
			o, err := ldap.DecompileFilter(filter)
			if err != nil {
				t.Errorf("Problem compiling %s - %s", i.filterStr, err.Error())
			} else if i.expectedFilter != o {
				t.Errorf("%q expected, got %q", i.expectedFilter, o)
			}
		}
	}
}

func TestInvalidFilter(t *testing.T) {
	for _, filterStr := range testInvalidFilters {
		if _, err := ldap.CompileFilter(filterStr); err == nil {
			t.Errorf("Problem compiling %s - expected err", filterStr)
		}
	}
}

func BenchmarkFilterCompile(b *testing.B) {
	b.StopTimer()
	filters := make([]string, len(testFilters))

	// Test Compiler and Decompiler
	for idx, i := range testFilters {
		filters[idx] = i.filterStr
	}

	maxIdx := len(filters)
	b.StartTimer()
	for i := 0; i < b.N; i++ {
		ldap.CompileFilter(filters[i%maxIdx])
	}
}

func BenchmarkFilterDecompile(b *testing.B) {
	b.StopTimer()
	filters := make([]*ber.Packet, len(testFilters))

	// Test Compiler and Decompiler
	for idx, i := range testFilters {
		filters[idx], _ = ldap.CompileFilter(i.filterStr)
	}

	maxIdx := len(filters)
	b.StartTimer()
	for i := 0; i < b.N; i++ {
		ldap.DecompileFilter(filters[i%maxIdx])
	}
}
