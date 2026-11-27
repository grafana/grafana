package nats

import (
	"net"
	"strings"

	"github.com/grafana/grafana/pkg/setting"
)

// resolveAdvertiseHost returns the host peers dial for this node's cluster
// route, and whether it was detected rather than configured. It returns "" when
// a wildcard listener has no usable interface address.
func resolveAdvertiseHost(cfg setting.NATSSettings, interfaceIPs func() ([]net.IP, error)) (string, bool) {
	// The operator knows the network best, e.g. hosts with several NICs or NAT.
	if host := bareHost(cfg.AdvertiseAddress); host != "" {
		return host, false
	}
	// A concrete listener only accepts routes on that address.
	listen := bareHost(cfg.ListenAddress)
	if listen != "" && !net.ParseIP(listen).IsUnspecified() {
		return listen, false
	}
	// A wildcard listener lets every HA instance share one config: in a container
	// or pod this is eth0. IPv6-only setups set advertise_address.
	ips, err := interfaceIPs()
	if err != nil {
		return "", false
	}
	for _, ip := range ips {
		if ip.To4() != nil && ip.IsGlobalUnicast() {
			return ip.String(), true
		}
	}
	return "", false
}

// bareHost strips the port and IPv6 brackets: the bound cluster_port is always
// advertised.
func bareHost(addr string) string {
	addr = strings.TrimSpace(addr)
	if h, _, err := net.SplitHostPort(addr); err == nil {
		return h
	}
	return strings.TrimSuffix(strings.TrimPrefix(addr, "["), "]")
}

// clusterAdvertise brackets an IPv6 literal, which Cluster.Advertise otherwise
// fails to parse when it appends the port.
func clusterAdvertise(host string) string {
	if strings.Contains(host, ":") {
		return "[" + host + "]"
	}
	return host
}

// upInterfaceIPs lists the addresses of up, non-loopback interfaces in
// interface order.
func upInterfaceIPs() ([]net.IP, error) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}
	var ips []net.IP
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, a := range addrs {
			if ipNet, ok := a.(*net.IPNet); ok {
				ips = append(ips, ipNet.IP)
			}
		}
	}
	return ips, nil
}
