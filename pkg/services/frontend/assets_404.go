package frontend

import (
	"errors"
	"net/http"
	"syscall"
)

func (s *frontendService) handleAssets404(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNotFound)
	_, err := w.Write([]byte("no assets from frontend-service"))
	if err != nil {
		if errors.Is(err, syscall.EPIPE) { // Client has stopped listening.
			return
		}

		s.log.Error("Error writing 404 response", "err", err)
	}
}
