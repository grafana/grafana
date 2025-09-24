package fpm

import "dagger.io/dagger"

const RubyContainer = "ruby:3.2.2-bullseye"

func Builder(d *dagger.Client) *dagger.Container {
	return d.Container().
		From(RubyContainer).
		WithEntrypoint(nil).
		WithExec([]string{"gem", "install", "fpm"}).
		WithExec([]string{"apt-get", "update"}).
		WithExec([]string{"apt-get", "install", "-yq", "rpm", "gnupg2"})
}
