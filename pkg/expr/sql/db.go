package sql

import (
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type DB struct {
}

func (db *DB) RunCommands(commands []string) (string, error) {
	return "", errors.New("not implemented")
}

func (db *DB) QueryFramesInto(name string, query string, frames []*data.Frame, f *data.Frame) error {
	return errors.New("not implemented")
}

func NewInMemoryDB() *DB {
	return &DB{}
}
