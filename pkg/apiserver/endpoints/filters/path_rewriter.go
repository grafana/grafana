package filters

import (
	"net/http"
	"regexp"
)

type PathRewriter struct {
	Pattern     *regexp.Regexp
	ReplaceFunc func([]string) string
}

func (r *PathRewriter) Rewrite(path string) (string, bool) {
	matches := r.Pattern.FindStringSubmatch(path)
	if matches == nil {
		return path, false
	}
	return r.ReplaceFunc(r.Pattern.FindStringSubmatch(path)), true
}

func WithPathRewriters(handler http.Handler, rewriters []PathRewriter) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		for _, rewriter := range rewriters {
			if newPath, ok := rewriter.Rewrite(req.URL.Path); ok {
				req.URL.Path = newPath
				break
			}
		}
		handler.ServeHTTP(w, req)
	})
}
