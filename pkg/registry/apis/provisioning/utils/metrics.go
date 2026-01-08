package utils

const (
	SuccessOutcome = "success"
	ErrorOutcome   = "error"
)

func GetResourceCountBucket(count int) string {
	switch {
	case count == 0:
		return "0"
	case count <= 10:
		return "1-10"
	case count <= 50:
		return "11-50"
	case count <= 100:
		return "51-100"
	case count <= 500:
		return "101-500"
	case count <= 1000:
		return "501-1000"
	default:
		return "1000+"
	}
}
