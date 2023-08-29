package idsignertest

import (
	"net/http"

	"github.com/grafana/grafana/pkg/services/auth/identity"
)

type FakeService struct{}

func (s *FakeService) ActiveUserAssertion(id identity.Requester, req *http.Request) (string, error) {
	// Return a dummy assertion string and no error
	return "dummy_assertion", nil
}
