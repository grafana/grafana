package setting

import "github.com/mattn/go-xmpp"

// XMPP settings
var (
	XMPPEnabled bool
	XMPP        xmpp.Options
)

func readXMPPSettings() {
	sec := Raw.Section("xmpp")
	XMPPEnabled = sec.Key("enabled").MustBool(false)
	XMPP.Host = sec.Key("host").String()
	XMPP.User = sec.Key("username").String()
	XMPP.Password = sec.Key("password").String()
	XMPP.Resource = sec.Key("resource").String()
	XMPP.Debug = sec.Key("debug").MustBool(false)
	XMPP.NoTLS = sec.Key("no_tls").MustBool(false)
	XMPP.StartTLS = sec.Key("start_tls").MustBool(false)
	XMPP.Session = sec.Key("session").MustBool(false)
	XMPP.Status = sec.Key("status").String()
	XMPP.StatusMessage = sec.Key("status_message").String()
}
