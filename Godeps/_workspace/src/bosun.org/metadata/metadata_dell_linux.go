package metadata

// Restrict to Linux because, although omreport runs fine on Windows, the
// Windows metadata uses WMI to fetch this information.

import (
	"strings"

	"bosun.org/util"
)

func init() {
	metafuncs = append(metafuncs, collectMetadataOmreport)
}

func collectMetadataOmreport() {
	_ = util.ReadCommand(func(line string) error {
		fields := strings.Split(line, ";")
		if len(fields) != 2 {
			return nil
		}
		switch fields[0] {
		case "Chassis Service Tag":
			AddMeta("", nil, "serialNumber", fields[1], true)
		case "Chassis Model":
			AddMeta("", nil, "model", fields[1], true)
		}
		return nil
	}, "omreport", "chassis", "info", "-fmt", "ssv")
}
