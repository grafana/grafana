package ofrep

// publicFlags contains the list of flags that can be evaluated by unauthenticated users
var publicFlags = map[string]bool{
	"testflag": true,
}

func isPublicFlag(flagKey string) bool {
	_, exists := publicFlags[flagKey]
	return exists
}
