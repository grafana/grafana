package frontend

import "net/http"

func (s *frontendService) handleAssets404(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNotFound)
	w.Write([]byte("no assets from frontend-service"))
}
