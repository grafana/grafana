package uidgen

import "github.com/grafana/grafana/pkg/plugins"

type PluginUID string //

type Generator interface {
	UID(jsonData plugins.JSONData) string
}

type SimpleUIDGenerator struct{}

func ProvideService() *SimpleUIDGenerator {
	return &SimpleUIDGenerator{}
}

func (g *SimpleUIDGenerator) UID(jsonData plugins.JSONData) string {
	return jsonData.ID
}
