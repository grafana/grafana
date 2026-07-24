package osutil

import (
	"os"
)

// Env collects global functions from standard package "os" that are related to
// environment variables. This allows abstracting code and provides a way to
// concurrently test code that needs access to these shared resources.
type Env interface {
	Setenv(key, value string) error
	Getenv(key string) string
}

// RealEnv implements Env interface by calling the actual global functions in
// package "os". This should be used by default anywhere that an Env is
// expected, and use MapEnv instead in your unit tests.
type RealEnv struct{}

func (RealEnv) Setenv(key, value string) error {
	return os.Setenv(key, value)
}

func (RealEnv) Getenv(key string) string {
	return os.Getenv(key)
}

// MapEnv is a fake implementing Env interface. It is purposefully not
// concurrency-safe, so if your tests using it panic due to concurrent map
// access, then you need to fix a data race in your code. This is
// because environment variables are globals to a process, so you should be
// properly synchronizing access to them (e.g. with a mutex).
type MapEnv map[string]string

func (m MapEnv) Setenv(key, value string) error {
	m[key] = value
	return nil
}

func (m MapEnv) Getenv(key string) string {
	return m[key]
}
