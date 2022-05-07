package ldap

import (
	"crypto/tls"

	"gopkg.in/ldap.v3"

	//TODO(sh0rez): remove once import cycle resolved
	_ "github.com/grafana/grafana/pkg/api/response"
)

type searchFunc = func(request *ldap.SearchRequest) (*ldap.SearchResult, error)

// MockConnection struct for testing
type MockConnection struct {
	SearchFunc       searchFunc
	SearchCalled     bool
	SearchAttributes []string

	AddParams *ldap.AddRequest
	AddCalled bool

	DelParams *ldap.DelRequest
	DelCalled bool

	CloseCalled bool

	UnauthenticatedBindCalled bool
	BindCalled                bool

	BindProvider                func(username, password string) error
	UnauthenticatedBindProvider func() error
}

// Bind mocks Bind connection function
func (c *MockConnection) Bind(username, password string) error {
	c.BindCalled = true

	if c.BindProvider != nil {
		return c.BindProvider(username, password)
	}

	return nil
}

// UnauthenticatedBind mocks UnauthenticatedBind connection function
func (c *MockConnection) UnauthenticatedBind(username string) error {
	c.UnauthenticatedBindCalled = true

	if c.UnauthenticatedBindProvider != nil {
		return c.UnauthenticatedBindProvider()
	}

	return nil
}

// Close mocks Close connection function
func (c *MockConnection) Close() {
	c.CloseCalled = true
}

func (c *MockConnection) setSearchResult(result *ldap.SearchResult) {
	c.SearchFunc = func(request *ldap.SearchRequest) (*ldap.SearchResult, error) {
		return result, nil
	}
}

func (c *MockConnection) setSearchError(err error) {
	c.SearchFunc = func(request *ldap.SearchRequest) (*ldap.SearchResult, error) {
		return nil, err
	}
}

func (c *MockConnection) setSearchFunc(fn searchFunc) {
	c.SearchFunc = fn
}

// Search mocks Search connection function
func (c *MockConnection) Search(sr *ldap.SearchRequest) (*ldap.SearchResult, error) {
	c.SearchCalled = true
	c.SearchAttributes = sr.Attributes

	return c.SearchFunc(sr)
}

// Add mocks Add connection function
func (c *MockConnection) Add(request *ldap.AddRequest) error {
	c.AddCalled = true
	c.AddParams = request
	return nil
}

// Del mocks Del connection function
func (c *MockConnection) Del(request *ldap.DelRequest) error {
	c.DelCalled = true
	c.DelParams = request
	return nil
}

// StartTLS mocks StartTLS connection function
func (c *MockConnection) StartTLS(*tls.Config) error {
	return nil
}
