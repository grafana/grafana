// Copyright 2014 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package icmp_test

import (
	"errors"
	"net"
	"os"
	"runtime"
	"testing"

	"bosun.org/_third_party/golang.org/x/net/icmp"
	"bosun.org/_third_party/golang.org/x/net/internal/iana"
	"bosun.org/_third_party/golang.org/x/net/internal/nettest"
	"bosun.org/_third_party/golang.org/x/net/ipv4"
	"bosun.org/_third_party/golang.org/x/net/ipv6"
)

func googleAddr(c *icmp.PacketConn, protocol int) (net.Addr, error) {
	const host = "www.google.com"
	ips, err := net.LookupIP(host)
	if err != nil {
		return nil, err
	}
	netaddr := func(ip net.IP) (net.Addr, error) {
		switch c.LocalAddr().(type) {
		case *net.UDPAddr:
			return &net.UDPAddr{IP: ip}, nil
		case *net.IPAddr:
			return &net.IPAddr{IP: ip}, nil
		default:
			return nil, errors.New("neither UDPAddr nor IPAddr")
		}
	}
	for _, ip := range ips {
		switch protocol {
		case iana.ProtocolICMP:
			if ip.To4() != nil {
				return netaddr(ip)
			}
		case iana.ProtocolIPv6ICMP:
			if ip.To16() != nil && ip.To4() == nil {
				return netaddr(ip)
			}
		}
	}
	return nil, errors.New("no A or AAAA record")
}

var pingGoogleTests = []struct {
	network, address string
	protocol         int
	mtype            icmp.Type
}{
	{"udp4", "0.0.0.0", iana.ProtocolICMP, ipv4.ICMPTypeEcho},
	{"ip4:icmp", "0.0.0.0", iana.ProtocolICMP, ipv4.ICMPTypeEcho},

	{"udp6", "::", iana.ProtocolIPv6ICMP, ipv6.ICMPTypeEchoRequest},
	{"ip6:ipv6-icmp", "::", iana.ProtocolIPv6ICMP, ipv6.ICMPTypeEchoRequest},
}

func TestPingGoogle(t *testing.T) {
	if testing.Short() {
		t.Skip("to avoid external network")
	}
	switch runtime.GOOS {
	case "darwin":
	case "linux":
		t.Log("you may need to adjust the net.ipv4.ping_group_range kernel state")
	default:
		t.Skipf("not supported on %s", runtime.GOOS)
	}

	m, ok := nettest.SupportsRawIPSocket()
	for i, tt := range pingGoogleTests {
		if tt.network[:2] == "ip" && !ok {
			t.Log(m)
			continue
		}
		c, err := icmp.ListenPacket(tt.network, tt.address)
		if err != nil {
			t.Error(err)
			continue
		}
		defer c.Close()

		dst, err := googleAddr(c, tt.protocol)
		if err != nil {
			t.Error(err)
			continue
		}

		wm := icmp.Message{
			Type: tt.mtype, Code: 0,
			Body: &icmp.Echo{
				ID: os.Getpid() & 0xffff, Seq: 1 << uint(i),
				Data: []byte("HELLO-R-U-THERE"),
			},
		}
		wb, err := wm.Marshal(nil)
		if err != nil {
			t.Error(err)
			continue
		}
		if n, err := c.WriteTo(wb, dst); err != nil {
			t.Error(err, dst)
			continue
		} else if n != len(wb) {
			t.Errorf("got %v; want %v", n, len(wb))
			continue
		}

		rb := make([]byte, 1500)
		n, peer, err := c.ReadFrom(rb)
		if err != nil {
			t.Error(err)
			continue
		}
		rm, err := icmp.ParseMessage(tt.protocol, rb[:n])
		if err != nil {
			t.Error(err)
			continue
		}
		switch rm.Type {
		case ipv4.ICMPTypeEchoReply, ipv6.ICMPTypeEchoReply:
			t.Logf("got reflection from %v", peer)
		default:
			t.Errorf("got %+v; want echo reply", rm)
		}
	}
}
