package metadata

import (
	"errors"
	"io/ioutil"
	"net"
	"strconv"
	"strings"

	"bosun.org/opentsdb"
	"bosun.org/util"
)

func init() {
	metafuncs = append(metafuncs, metaLinuxVersion, metaLinuxIfaces)
}

func metaLinuxVersion() {
	_ = util.ReadCommand(func(line string) error {
		AddMeta("", nil, "uname", line, true)
		return nil
	}, "uname", "-a")
	_ = util.ReadCommand(func(line string) error {
		fields := strings.Fields(line)
		hasNum := false
		for i := 0; i < len(fields); {
			if strings.HasPrefix(fields[i], `\`) {
				fields = append(fields[:i], fields[i+1:]...)
			} else {
				if v, _ := strconv.ParseFloat(fields[i], 32); v > 0 {
					hasNum = true
				}
				i++
			}
		}
		if !hasNum {
			return nil
		}
		AddMeta("", nil, "version", strings.Join(fields, " "), true)
		return nil
	}, "cat", "/etc/issue")
}

var doneErr = errors.New("")

// metaLinuxIfacesMaster returns the bond master from s or "" if none exists.
func metaLinuxIfacesMaster(line string) string {
	sp := strings.Fields(line)
	for i := 4; i < len(sp); i += 2 {
		if sp[i-1] == "master" {
			return sp[i]
		}
	}
	return ""
}

func metaLinuxIfaces() {
	metaIfaces(func(iface net.Interface, tags opentsdb.TagSet) {
		if speed, err := ioutil.ReadFile("/sys/class/net/" + iface.Name + "/speed"); err == nil {
			v, _ := strconv.Atoi(strings.TrimSpace(string(speed)))
			if v > 0 {
				const MbitToBit = 1e6
				AddMeta("", tags, "speed", v*MbitToBit, true)
			}
		}
		_ = util.ReadCommand(func(line string) error {
			if v := metaLinuxIfacesMaster(line); v != "" {
				AddMeta("", tags, "master", v, true)
				return doneErr
			}
			return nil
		}, "ip", "-o", "addr", "show", iface.Name)
	})
}
