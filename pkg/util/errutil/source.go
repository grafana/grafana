package errutil

// Source identifies from where an error originates.
type Source string

const (
	// SourceServer implies error originates from within the server, i.e. this application.
	SourceServer Source = "server"

	// SourceDownstream implies error originates from downstream services, i.e. from outgoing connections/requests.
	SourceDownstream Source = "downstream"
)

// IsServer checks if Source is SourceServer.
func (s Source) IsServer() bool {
	return s == SourceServer
}

// IsDownstream checks if Source is SourceDownstream.
func (s Source) IsDownstream() bool {
	return s == SourceDownstream
}
