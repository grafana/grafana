//go:build windows
// +build windows

package kerberos

import (
	"github.com/alexbrainman/sspi"
	"github.com/alexbrainman/sspi/negotiate"
)

// GSS implements the pq.GSS interface.
type GSS struct {
	creds *sspi.Credentials
	ctx   *negotiate.ClientContext
}

// NewGSS creates a new GSS provider.
func NewGSS() (*GSS, error) {
	g := &GSS{}
	err := g.init()

	if err != nil {
		return nil, err
	}

	return g, nil
}

func (g *GSS) init() error {
	creds, err := negotiate.AcquireCurrentUserCredentials()
	if err != nil {
		return err
	}

	g.creds = creds
	return nil
}

// GetInitToken implements the GSS interface.
func (g *GSS) GetInitToken(host string, service string) ([]byte, error) {

	host, err := canonicalizeHostname(host)
	if err != nil {
		return nil, err
	}

	spn := service + "/" + host

	return g.GetInitTokenFromSpn(spn)
}

// GetInitTokenFromSpn implements the GSS interface.
func (g *GSS) GetInitTokenFromSpn(spn string) ([]byte, error) {
	ctx, token, err := negotiate.NewClientContext(g.creds, spn)
	if err != nil {
		return nil, err
	}

	g.ctx = ctx

	return token, nil
}

// Continue implements the GSS interface.
func (g *GSS) Continue(inToken []byte) (done bool, outToken []byte, err error) {
	return g.ctx.Update(inToken)
}
