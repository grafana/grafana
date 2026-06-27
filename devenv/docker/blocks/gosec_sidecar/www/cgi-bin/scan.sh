#!/bin/sh
set -e

if [ -z "$GITHUB_AUTH_TOKEN" ]; then
  printf "Status: 500 Internal Server Error\r\nContent-Type: application/json\r\n\r\n"
  printf '{"error":"GITHUB_AUTH_TOKEN is not set. Start the container with -e GITHUB_AUTH_TOKEN=<token>"}\n'
  exit 0
fi

repo=$(echo "$QUERY_STRING" | sed 's/.*repo=\([^&]*\).*/\1/' | sed 's/%2F/\//g')

if [ -z "$repo" ]; then
  printf "Status: 400 Bad Request\r\nContent-Type: application/json\r\n\r\n"
  printf '{"error":"missing repo query parameter"}\n'
  exit 0
fi

# Strip leading github.com/ prefix if present
repo=$(echo "$repo" | sed 's|^github\.com/||')

repodir="/tmp/goscan_$(echo "$repo" | tr '/' '_')"
rm -rf "$repodir"

git clone --depth=1 \
  "https://x-access-token:${GITHUB_AUTH_TOKEN}@github.com/${repo}.git" \
  "$repodir" \
  2>/tmp/clone_err || true

if [ ! -d "$repodir" ]; then
  printf "Status: 404 Not Found\r\nContent-Type: application/json\r\n\r\n"
  printf '{"error":"failed to clone repo: %s"}\n' "$(cat /tmp/clone_err | tr '"' "'" | tr '\n' ' ')"
  exit 0
fi

# Check for Go files — skip if none
gofiles=$(find "$repodir" -name "*.go" -not -path "*/vendor/*" 2>/dev/null | head -1)
if [ -z "$gofiles" ]; then
  rm -rf "$repodir"
  printf "Content-Type: application/json\r\n\r\n"
  printf '{"Issues":[],"Stats":{},"GosecVersion":"","message":"no Go source files found"}\n'
  exit 0
fi

# Download dependencies so gosec can resolve types
if [ -f "$repodir/go.mod" ]; then
  cd "$repodir" && go mod download 2>/tmp/gomod_err || true
fi

output=$(gosec -fmt json -quiet ./... 2>/tmp/gosec_err || true)

rm -rf "$repodir"

if [ -z "$output" ]; then
  printf "Content-Type: application/json\r\n\r\n"
  printf '{"Issues":[],"Stats":{},"GosecVersion":"","message":"no issues found or scan produced no output"}\n'
  exit 0
fi

printf "Content-Type: application/json\r\n\r\n"
printf '%s\n' "$output"
