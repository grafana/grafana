package cloudmonitoring

type preprocessorType int

const (
	PreprocessorTypeNone preprocessorType = iota
	PreprocessorTypeRate
	PreprocessorTypeDelta
)

func toPreprocessorType(preprocessorTypeString string) preprocessorType {
	switch preprocessorTypeString {
	case "none":
		return PreprocessorTypeNone
	case "rate":
		return PreprocessorTypeRate
	case "delta":
		return PreprocessorTypeDelta
	default:
		return PreprocessorTypeNone
	}
}
