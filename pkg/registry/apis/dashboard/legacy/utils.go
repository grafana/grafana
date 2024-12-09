package legacy

func getResourceVersion(id int64, version int64) int64 {
	return version + (id * 10000000)
}

func getVersionFromRV(rv int64) int64 {
	return rv % 10000000
}
