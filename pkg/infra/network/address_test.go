package network

import (
	"net"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetIPFromAddress(t *testing.T) {
	testCases := []struct {
		desc   string
		input  string
		exp    string
		expErr string
	}{
		{
			desc:  "Valid IPv4",
			input: "192.168.2.1",
			exp:   "192.168.2.1",
		},
		{
			desc:  "Valid IPv6",
			input: "2001:0db8:0000:0000:0000:ff00:0042:8329",
			exp:   "2001:db8::ff00:42:8329",
		},
		{
			desc:  "Valid IPv6 enclosed in square brackets",
			input: "[2001:0db8:0000:0000:0000:ff00:0042:8329]",
			exp:   "2001:db8::ff00:42:8329",
		},
		{
			desc:  "Valid IPv4/port pair",
			input: "192.168.2.1:5000",
			exp:   "192.168.2.1",
		},
		{
			desc:  "Valid IPv6/port pair",
			input: "[2001:0db8:0000:0000:0000:ff00:0042:8329]:5000",
			exp:   "2001:db8::ff00:42:8329",
		},
		{
			desc:   "Invalid IPv6/port pair",
			input:  "[2001:0db8:0000:0000:0000:ff00:0042:8329]:5000:2000",
			expErr: `not a valid IP address or IP address/port pair: "[2001:0db8:0000:0000:0000:ff00:0042:8329]:5000:2000"`,
		},
		{
			desc:   "IPv6 with too many parts",
			input:  "2001:0db8:0000:0000:0000:ff00:0042:8329:1234",
			expErr: `not a valid IP address or IP address/port pair: "2001:0db8:0000:0000:0000:ff00:0042:8329:1234"`,
		},
		{
			desc:   "IPv6 with too few parts",
			input:  "2001:0db8:0000:0000:0000:ff00:0042",
			expErr: `not a valid IP address or IP address/port pair: "2001:0db8:0000:0000:0000:ff00:0042"`,
		},
		{
			desc:  "Valid shortened IPv6",
			input: "2001:db8::ff00:42:8329",
			exp:   "2001:db8::ff00:42:8329",
		},
		{
			desc:  "IPv6 loopback address",
			input: "::1",
			exp:   "::1",
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			ip, err := GetIPFromAddress(tc.input)
			if tc.expErr == "" {
				exp := net.ParseIP(tc.exp)
				require.NotNil(t, exp)
				require.NoError(t, err)
				assert.Equal(t, exp, ip)
			} else {
				require.EqualError(t, err, tc.expErr)
			}
		})
	}
}
