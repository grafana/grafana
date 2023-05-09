package oauthtest

import (
	"context"

	"github.com/stretchr/testify/mock"
	"gopkg.in/square/go-jose.v2"

	"github.com/grafana/grafana/pkg/services/oauthserver"
)

type MockStore struct {
	mock.Mock
}

var _ oauthserver.Store = &FakeStore{}

// GetExternalService implements oauthserver.Store
func (ms *MockStore) GetExternalService(ctx context.Context, id string) (*oauthserver.Client, error) {
	mockArgs := ms.Called(ctx, id)
	client := mockArgs.Get(0)
	err := mockArgs.Error(1)
	if client == nil {
		return nil, err
	}
	return client.(*oauthserver.Client), err
}

// GetExternalServiceByName implements oauthserver.Store
func (ms *MockStore) GetExternalServiceByName(ctx context.Context, app string) (*oauthserver.Client, error) {
	mockArgs := ms.Called(ctx, app)
	client := mockArgs.Get(0)
	err := mockArgs.Error(1)
	if client == nil {
		return nil, err
	}
	return client.(*oauthserver.Client), err
}

// GetExternalServicePublicKey implements oauthserver.Store
func (ms *MockStore) GetExternalServicePublicKey(ctx context.Context, id string) (*jose.JSONWebKey, error) {
	mockArgs := ms.Called(ctx, id)
	return mockArgs.Get(0).(*jose.JSONWebKey), mockArgs.Error(1)
}

// RegisterExternalService implements oauthserver.Store
func (ms *MockStore) RegisterExternalService(ctx context.Context, client *oauthserver.Client) error {
	mockArgs := ms.Called(ctx, client)
	return mockArgs.Error(0)
}

// RegisterExternalService implements oauthserver.Store
func (ms *MockStore) SaveExternalService(ctx context.Context, client *oauthserver.Client) error {
	mockArgs := ms.Called(ctx, client)
	return mockArgs.Error(0)
}
