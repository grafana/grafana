package featuremgmt

import "github.com/open-feature/go-sdk/openfeature/memprovider"

type FlagType int

const (
	FlagTypeBoolean FlagType = iota
	FlagTypeInteger
	FlagTypeFloat
	FlagTypeString
	FlagTypeObject
)

type TypedFlag memprovider.InMemoryFlag

func (f *TypedFlag) GetFlagType() FlagType {
	value := f.Variants[f.DefaultVariant]

	switch value.(type) {
	case bool:
		return FlagTypeBoolean
	case int, int8, int16, int32, int64:
		return FlagTypeInteger
	case float32, float64:
		return FlagTypeFloat
	case string:
		return FlagTypeString
	default:
		return FlagTypeObject
	}
}
