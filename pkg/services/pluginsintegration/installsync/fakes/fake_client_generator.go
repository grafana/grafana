package fakes

import (
	"github.com/grafana/grafana-app-sdk/resource"
)

type FakeClientGenerator struct {
	ClientFunc func(kind resource.Kind) (resource.Client, error)
}

func NewFakeClientGenerator() *FakeClientGenerator {
	return &FakeClientGenerator{
		ClientFunc: func(kind resource.Kind) (resource.Client, error) {
			return nil, nil
		},
	}
}

func (f *FakeClientGenerator) ClientFor(kind resource.Kind) (resource.Client, error) {
	if f.ClientFunc != nil {
		return f.ClientFunc(kind)
	}
	return nil, nil
}
