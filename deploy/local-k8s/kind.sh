#!/bin/sh
set -eu

root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
version=v0.29.0
case $(uname -s) in
  Darwin) goos=darwin ;;
  Linux) goos=linux ;;
  *) echo 'kind helper supports macOS and Linux' >&2; exit 1 ;;
esac
case $(uname -m) in
  arm64|aarch64) goarch=arm64 ;;
  x86_64|amd64) goarch=amd64 ;;
  *) echo 'kind helper supports arm64 and amd64' >&2; exit 1 ;;
esac

tool_dir=${TMPDIR:-/tmp}/error-tracking-kind/$version-$goos-$goarch
binary=$tool_dir/kind
if [ ! -x "$binary" ]; then
  mkdir -p "$tool_dir"
  docker build \
    --build-arg "KIND_VERSION=$version" \
    --build-arg "KIND_GOOS=$goos" \
    --build-arg "KIND_GOARCH=$goarch" \
    --output "type=local,dest=$tool_dir" \
    -f "$root/deploy/local-k8s/Dockerfile.kind" "$root/deploy/local-k8s" >/dev/null
  chmod 755 "$binary"
fi
exec "$binary" "$@"
