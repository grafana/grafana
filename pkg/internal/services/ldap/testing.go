package ldap

import (
	"crypto/tls"

	"gopkg.in/ldap.v3"
)

// MockConnection struct for testing
type MockConnection struct {
	SearchResult     *ldap.SearchResult
	SearchError      error
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
	c.SearchResult = result
}

func (c *MockConnection) setSearchError(err error) {
	c.SearchError = err
}

// Search mocks Search connection function
func (c *MockConnection) Search(sr *ldap.SearchRequest) (*ldap.SearchResult, error) {
	c.SearchCalled = true
	c.SearchAttributes = sr.Attributes

	if c.SearchError != nil {
		return nil, c.SearchError
	}

	return c.SearchResult, nil
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
