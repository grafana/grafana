package main

import "regexp"

// extEnterpriseLinkedRE matches common assignments linking enterprise in ext.go
// (spacing-insensitive around =).
var extEnterpriseLinkedRE = regexp.MustCompile(`IsEnterprise\s*=\s*true`)

func extGoIndicatesEnterpriseLinked(src []byte) bool {
	return extEnterpriseLinkedRE.Match(src)
}
