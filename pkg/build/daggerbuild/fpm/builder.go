package fpm

import "dagger.io/dagger"

// bullseye (Debian 11) was here previously; its debian-security archive prunes old
// point-release .deb files once superseded, so a long-lived Dagger layer cache can end up
// re-running `apt-get install` against package versions that have since 404'd off the mirror.
// bookworm (Debian 12) is still in full support and not exposed to the same staleness yet.
const RubyContainer = "ruby:3.2-bookworm"

func Builder(d *dagger.Client) *dagger.Container {
	return d.Container().
		From(RubyContainer).
		WithEntrypoint(nil).
		WithExec([]string{"gem", "install", "fpm"}).
		WithExec([]string{"apt-get", "update"}).
		WithExec([]string{"apt-get", "install", "-yq", "rpm", "gnupg2"})
}
