package pq

// NewGSSFunc creates a GSS authentication provider, for use with
// RegisterGSSProvider.
type NewGSSFunc func() (GSS, error)

var newGss NewGSSFunc

// RegisterGSSProvider registers a GSS authentication provider. For example, if
// you need to use Kerberos to authenticate with your server, add this to your
// main package:
//
//	import "gitee.com/opengauss/openGauss-connector-go-pq/auth/kerberos"
//
//	func init() {
//		pq.RegisterGSSProvider(func() (pq.GSS, error) { return kerberos.NewGSS() })
//	}
func RegisterGSSProvider(newGssArg NewGSSFunc) {
	newGss = newGssArg
}

// GSS provides GSSAPI authentication (e.g., Kerberos).
type GSS interface {
	GetInitToken(host string, service string) ([]byte, error)
	GetInitTokenFromSpn(spn string) ([]byte, error)
	Continue(inToken []byte) (done bool, outToken []byte, err error)
}
