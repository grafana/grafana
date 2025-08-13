package kerberos

import (
	"net"
	"strings"
)

/*
 *  Find the A record associated with a hostname
 *  In general, hostnames supplied to the driver should be
 *  canonicalized because the KDC usually only has one
 *  principal and not one per potential alias of a host.
 */
func canonicalizeHostname(host string) (string, error) {
	canon := host

	name, err := net.LookupCNAME(host)
	if err != nil {
		return "", err
	}

	name = strings.TrimSuffix(name, ".")

	if name != "" {
		canon = name
	}

	return canon, nil
}
