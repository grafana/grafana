package message

type MessageType int

const (
	MessageText MessageType = iota
	MessageBinary
)
