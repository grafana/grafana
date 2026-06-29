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

repo=$(echo "$repo" | sed 's|^github\.com/||')

repodir="/tmp/vuln_$(echo "$repo" | tr '/' '_')"
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

if [ ! -f "$repodir/go.mod" ]; then
  rm -rf "$repodir"
  printf "Content-Type: application/json\r\n\r\n"
  printf '{"message":"no go.mod found","findings":[]}\n'
  exit 0
fi

cd "$repodir"
go mod download 2>/tmp/gomod_err || true

output=$(govulncheck -json ./... 2>/tmp/vuln_err || true)

rm -rf "$repodir"

if [ -z "$output" ]; then
  printf "Content-Type: application/json\r\n\r\n"
  printf '{"message":"no vulnerabilities found or scan produced no output","findings":[]}\n'
  exit 0
fi

printf "Content-Type: application/json\r\n\r\n"
printf '%s\n' "$output"
