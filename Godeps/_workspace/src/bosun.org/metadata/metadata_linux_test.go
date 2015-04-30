package metadata

import "testing"

func TestLinuxIpAddrShowMaster(t *testing.T) {
	inputs := map[string]string{
		"bond0": `2: em1: <BROADCAST,MULTICAST,SLAVE,UP,LOWER_UP> mtu 1500 qdisc mq master bond0 state UP qlen 1000\    link/ether bc:30:5b:ed:c0:80 brd ff:ff:ff:ff:ff:ff`,
		"bond1": `5: em4: <BROADCAST,MULTICAST,SLAVE,UP,LOWER_UP> mtu 1500 qdisc mq master bond1 state UP qlen 1000\    link/ether bc:30:5b:ed:c0:3a brd ff:ff:ff:ff:ff:ff`,
		"":      `7: bond1: <BROADCAST,MULTICAST,MASTER,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP \    link/ether bc:30:5b:ed:c0:3a brd ff:ff:ff:ff:ff:ff`,
	}
	for expect, val := range inputs {
		got := metaLinuxIfacesMaster(val)
		if got != expect {
			t.Errorf("%v: expected %v, got %v", val, expect, got)
		}
	}
}
