package metadata

import (
	"fmt"
	"net"
	"strings"

	"bosun.org/opentsdb"
)

func metaIfaces(f func(iface net.Interface, tags opentsdb.TagSet)) {
	ifaces, _ := net.Interfaces()
	for _, iface := range ifaces {
		if strings.HasPrefix(iface.Name, "lo") {
			continue
		}
		tags := opentsdb.TagSet{"iface": fmt.Sprint("Interface", iface.Index)}
		AddMeta("", tags, "name", iface.Name, true)
		if mac := iface.HardwareAddr.String(); mac != "" {
			AddMeta("", tags, "mac", iface.HardwareAddr.String(), true)
		}
		ads, _ := iface.Addrs()
		for i, ad := range ads {
			addr := strings.Split(ad.String(), "/")[0]
			AddMeta("", opentsdb.TagSet{"addr": fmt.Sprint("Addr", i)}.Merge(tags), "addr", addr, true)
		}
		if f != nil {
			f(iface, tags)
		}
	}
}
