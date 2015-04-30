package metadata

import (
	"fmt"
	"strings"

	"bosun.org/util"
)

func init() {
	metafuncs = append(metafuncs, metaDarwinVersion, metaDarwinInterfaces)
}

func metaDarwinVersion() {
	util.ReadCommand(func(line string) error {
		AddMeta("", nil, "uname", line, true)
		return nil
	}, "uname", "-a")
	var name, vers, build string
	util.ReadCommand(func(line string) error {
		sp := strings.SplitN(line, ":", 2)
		if len(sp) != 2 {
			return nil
		}
		v := strings.TrimSpace(sp[1])
		switch sp[0] {
		case "ProductName":
			name = v
		case "ProductVersion":
			vers = v
		case "BuildVersion":
			build = v
		}
		return nil
	}, "sw_vers")
	if name != "" && vers != "" && build != "" {
		AddMeta("", nil, "version", fmt.Sprintf("%s.%s", vers, build), true)
		AddMeta("", nil, "versionCaption", fmt.Sprintf("%s %s", name, vers), true)
	}
}

func metaDarwinInterfaces() {
	metaIfaces(nil)
}
