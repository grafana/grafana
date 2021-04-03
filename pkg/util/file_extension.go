package util

func GetFileExtensionByContentType(contentType string) string {
	extensions := map[string]string{
		"text/html":  ".html",
		"text/plain": ".txt",
	}
	return extensions[contentType]
}
