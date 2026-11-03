package nats

import (
	natsserver "github.com/nats-io/nats-server/v2/server"
)

// restrictToInProcessClients keeps the client port off the network. Grafana
// connects in-process, but DontListen also stops nats-server from routing, so
// bind an ephemeral loopback port instead and reject every socket client on it.
func restrictToInProcessClients(opts *natsserver.Options) {
	opts.Host = "127.0.0.1"
	opts.Port = natsserver.RANDOM_PORT
	opts.CustomClientAuthentication = inProcessOnly{}
}

// inProcessOnly accepts only in-process clients, which reach the server over
// net.Pipe instead of a socket.
type inProcessOnly struct{}

func (inProcessOnly) Check(c natsserver.ClientAuthentication) bool {
	addr := c.RemoteAddress()
	return addr != nil && addr.Network() == "pipe"
}
