// 2022/4/15 Bin Liu <bin.liu@enmotech.com>

package oid

import (
	"strings"
)

func ConvertOidsToString(oids []Oid) string {
	var list []string
	for _, l := range oids {
		s, ok := TypeName[l]
		if !ok {
			s = ""
		}
		list = append(list, s)
	}
	return strings.Join(list, ",")
}
