package historian

import (
	"encoding/json"
	"fmt"
)

type jsonEncoder struct{}

func (e jsonEncoder) encode(s []stream) ([]byte, error) {
	body := struct {
		Streams []stream `json:"streams"`
	}{Streams: s}
	enc, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize Loki payload: %w", err)
	}
	return enc, nil
}

func (e jsonEncoder) headers() map[string]string {
	return map[string]string{
		"Content-Type": "application/json",
	}
}

type snappyProtoEncoder struct{}

func (e snappyProtoEncoder) headers() map[string]string {
	return map[string]string{
		"Content-Type":     "application/x-protobuf",
		"Content-Encoding": "snappy",
	}
}
