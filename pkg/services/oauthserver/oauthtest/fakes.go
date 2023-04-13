package oauthtest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/oauthserver"
	"gopkg.in/square/go-jose.v2"
)

type FakeStore struct {
	ExpectedClient *oauthserver.Client
	ExpectedKey    *jose.JSONWebKey
	ExpectedErr    error
}

var _ oauthserver.Store = &FakeStore{}

// GetExternalService implements oauthserver.Store
func (fs *FakeStore) GetExternalService(ctx context.Context, id string) (*oauthserver.Client, error) {
	return fs.ExpectedClient, fs.ExpectedErr
}

// GetExternalServiceByName implements oauthserver.Store
func (fs *FakeStore) GetExternalServiceByName(ctx context.Context, app string) (*oauthserver.Client, error) {
	return fs.ExpectedClient, fs.ExpectedErr
}

// GetExternalServicePublicKey implements oauthserver.Store
func (fs *FakeStore) GetExternalServicePublicKey(ctx context.Context, id string) (*jose.JSONWebKey, error) {
	return fs.ExpectedKey, fs.ExpectedErr
}

// RegisterExternalService implements oauthserver.Store
func (fs *FakeStore) RegisterExternalService(ctx context.Context, client *oauthserver.Client) error {
	return fs.ExpectedErr
}

// RegisterExternalService implements oauthserver.Store
func (fs *FakeStore) SaveExternalService(ctx context.Context, client *oauthserver.Client) error {
	return fs.ExpectedErr
}
