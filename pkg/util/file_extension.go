package util

func GetFileExtensionByContentType(contentType string) string {
	switch contentType {
		"text/html":
			return ".html"
		"text/plain": 
			return ".txt"
		default:
			panic(fmt.Sprintf("Unrecognized content type %q", contentType))
	}
}
