package ldap

import (
	"log"

	"github.com/gogits/gogs/modules/asn1-ber"
)

// debugging type
//     - has a Printf method to write the debug output
type debugging bool

// write debug output
func (debug debugging) Printf(format string, args ...interface{}) {
	if debug {
		log.Printf(format, args...)
	}
}

func (debug debugging) PrintPacket(packet *ber.Packet) {
	if debug {
		ber.PrintPacket(packet)
	}
}
