package msg

//go:generate stringer -type=Format

type Format uint8

// identifier of message format
const (
	FormatMetricDataArrayJson Format = iota
	FormatMetricDataArrayMsgp
)
