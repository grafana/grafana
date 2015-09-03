package nsq

// states
const (
	StateInit = iota
	StateDisconnected
	StateConnected
	StateSubscribed
	// StateClosing means CLOSE has started...
	// (responses are ok, but no new messages will be sent)
	StateClosing
)
