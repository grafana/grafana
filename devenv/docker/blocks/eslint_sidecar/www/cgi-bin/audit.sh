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

repodir="/tmp/audit_$(echo "$repo" | tr '/' '_')"
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

if [ ! -f "$repodir/package.json" ]; then
  rm -rf "$repodir"
  printf "Content-Type: application/json\r\n\r\n"
  printf '{"message":"no package.json found","metadata":{"vulnerabilities":{}},"vulnerabilities":{}}\n'
  exit 0
fi

cd "$repodir"
npm install --package-lock-only --silent 2>/tmp/npm_install_err || true

if [ ! -f "$repodir/package-lock.json" ]; then
  rm -rf "$repodir"
  printf "Content-Type: application/json\r\n\r\n"
  printf '{"message":"no package-lock.json could be generated","metadata":{"vulnerabilities":{}},"vulnerabilities":{}}\n'
  exit 0
fi

output=$(npm audit --json 2>/tmp/npm_audit_err || true)

rm -rf "$repodir"

if [ -z "$output" ]; then
  printf "Content-Type: application/json\r\n\r\n"
  printf '{"message":"npm audit produced no output","metadata":{"vulnerabilities":{}},"vulnerabilities":{}}\n'
  exit 0
fi

printf "Content-Type: application/json\r\n\r\n"
printf '%s\n' "$output"
