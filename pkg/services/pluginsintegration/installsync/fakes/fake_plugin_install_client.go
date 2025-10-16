package fakes

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

type FakePluginInstallClient struct {
	GetFunc     func(ctx context.Context, identifier resource.Identifier) (*pluginsv0alpha1.PluginInstall, error)
	ListAllFunc func(ctx context.Context, namespace string, options resource.ListOptions) (*pluginsv0alpha1.PluginInstallList, error)
	CreateFunc  func(ctx context.Context, identifier *pluginsv0alpha1.PluginInstall, options resource.CreateOptions) (*pluginsv0alpha1.PluginInstall, error)
	UpdateFunc  func(ctx context.Context, identifier *pluginsv0alpha1.PluginInstall, options resource.UpdateOptions) (*pluginsv0alpha1.PluginInstall, error)
	DeleteFunc  func(ctx context.Context, identifier resource.Identifier, options resource.DeleteOptions) error
}

func NewFakePluginInstallClient() *FakePluginInstallClient {
	return &FakePluginInstallClient{}
}

func (f *FakePluginInstallClient) Get(ctx context.Context, identifier resource.Identifier) (*pluginsv0alpha1.PluginInstall, error) {
	if f.GetFunc != nil {
		return f.GetFunc(ctx, identifier)
	}
	return nil, nil
}

func (f *FakePluginInstallClient) ListAll(ctx context.Context, namespace string, options resource.ListOptions) (*pluginsv0alpha1.PluginInstallList, error) {
	if f.ListAllFunc != nil {
		return f.ListAllFunc(ctx, namespace, options)
	}
	return &pluginsv0alpha1.PluginInstallList{}, nil
}

func (f *FakePluginInstallClient) Create(ctx context.Context, identifier *pluginsv0alpha1.PluginInstall, options resource.CreateOptions) (*pluginsv0alpha1.PluginInstall, error) {
	if f.CreateFunc != nil {
		return f.CreateFunc(ctx, identifier, options)
	}
	return identifier, nil
}

func (f *FakePluginInstallClient) Update(ctx context.Context, identifier *pluginsv0alpha1.PluginInstall, options resource.UpdateOptions) (*pluginsv0alpha1.PluginInstall, error) {
	if f.UpdateFunc != nil {
		return f.UpdateFunc(ctx, identifier, options)
	}
	return identifier, nil
}

func (f *FakePluginInstallClient) Delete(ctx context.Context, identifier resource.Identifier, options resource.DeleteOptions) error {
	if f.DeleteFunc != nil {
		return f.DeleteFunc(ctx, identifier, options)
	}
	return nil
}
