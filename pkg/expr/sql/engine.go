package sql

import "github.com/grafana/grafana-plugin-sdk-go/data"

type Engine = interface {
	RunCommands(commands []string) (string, error)
	QueryFramesInto(name string, query string, frames []*data.Frame, f *data.Frame) error
	QueryFrames(name string, query string, frames []*data.Frame) (string, error)
	Destroy() error
}
