package github

import (
	"context"

	"github.com/google/go-github/v66/github"
	mock "github.com/stretchr/testify/mock"
	"golang.org/x/oauth2"
)

type ClientFactory interface {
	New(ctx context.Context, ghToken string) Client
}

// An extension of mock.TestingT with a Cleanup function.
// The mock functions require this, so this is more succinct to deal with.
type TestingTWithCleanup = interface {
	Cleanup(func())
	mock.TestingT
}

type MockFactory struct {
	TestingT    TestingTWithCleanup
	Constructor func(TestingTWithCleanup) Client
}

func ProvideMockFactory(t TestingTWithCleanup) *MockFactory {
	return &MockFactory{
		TestingT: t,
	}
}

func (m *MockFactory) New(ctx context.Context, ghToken string) Client {
	if m.Constructor != nil {
		return m.Constructor(m.TestingT)
	}
	return NewMockClient(m.TestingT)
}

type RealFactory struct{}

func ProvideRealFactory() *RealFactory {
	return &RealFactory{}
}

func (*RealFactory) New(ctx context.Context, ghToken string) Client {
	tokenSrc := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: ghToken},
	)
	tokenClient := oauth2.NewClient(ctx, tokenSrc)
	githubClient := github.NewClient(tokenClient)
	return NewRealClient(githubClient)
}

var (
	_ ClientFactory = (*RealFactory)(nil)
	_ ClientFactory = (*MockFactory)(nil)
)
