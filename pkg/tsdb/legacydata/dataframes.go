package legacydata

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"
)

// DataFrames is an interface for retrieving encoded and decoded data frames.
//
// See NewDecodedDataFrames and NewEncodedDataFrames for more information.
type DataFrames interface {
	// Encoded encodes Frames into a slice of []byte.
	// If an error occurs [][]byte will be nil.
	// The encoded result, if any, will be cached and returned next time Encoded is called.
	Encoded() ([][]byte, error)

	// Decoded decodes a slice of Arrow encoded frames to data.Frames ([]*data.Frame).
	// If an error occurs Frames will be nil.
	// The decoded result, if any, will be cached and returned next time Decoded is called.
	Decoded() (data.Frames, error)
}

type dataFrames struct {
	decoded data.Frames
	encoded [][]byte
}

// NewDecodedDataFrames instantiates DataFrames from decoded frames.
//
// This should be the primary function for creating DataFrames if you're implementing a plugin.
// In a Grafana Alerting scenario it needs to operate on decoded frames, which is why this function is
// preferrable. When encoded data frames are needed, e.g. returned from Grafana HTTP API, it will
// happen automatically when MarshalJSON() is called.
func NewDecodedDataFrames(decodedFrames data.Frames) DataFrames {
	return &dataFrames{
		decoded: decodedFrames,
	}
}

func (df *dataFrames) Encoded() ([][]byte, error) {
	if df.encoded == nil {
		encoded, err := df.decoded.MarshalArrow()
		if err != nil {
			return nil, err
		}
		df.encoded = encoded
	}

	return df.encoded, nil
}

func (df *dataFrames) Decoded() (data.Frames, error) {
	if df.decoded == nil {
		decoded, err := data.UnmarshalArrowFrames(df.encoded)
		if err != nil {
			return nil, err
		}
		df.decoded = decoded
	}

	return df.decoded, nil
}

func (df *dataFrames) MarshalJSON() ([]byte, error) {
	encoded, err := df.Encoded()
	if err != nil {
		return nil, err
	}

	// Use a configuration that's compatible with the standard library
	// to minimize the risk of introducing bugs. This will make sure
	// that map keys is ordered.
	jsonCfg := jsoniter.ConfigCompatibleWithStandardLibrary
	return jsonCfg.Marshal(encoded)
}
