package base

import "regexp"

var extEnterpriseLinkedRE = regexp.MustCompile(`IsEnterprise\s*=\s*true`)

func ExtGoIndicatesEnterpriseLinked(src []byte) bool {
	return extEnterpriseLinkedRE.Match(src)
}
