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

# Strip leading github.com/ prefix if present — repo should be org/name only
repo=$(echo "$repo" | sed 's|^github\.com/||')

repodir="/tmp/scan_$(echo "$repo" | tr '/' '_')"
rm -rf "$repodir"

git clone --depth=1 \
  "https://x-access-token:${GITHUB_AUTH_TOKEN}@github.com/${repo}.git" \
  "$repodir" \
  2>/tmp/clone_err || true

if [ ! -d "$repodir" ]; then
  printf "Status: 404 Not Found\r\nContent-Type: application/json\r\n\r\n"
  printf '{"error":"failed to clone repo: %s"}\n' "$(cat /tmp/clone_err | tr '"' "'" | tr '\n' ' ')"
  rm -rf "$repodir"
  exit 0
fi

# Check for JS/TS files — skip if none found in src/
jsfiles=$(find "$repodir/src" -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" 2>/dev/null | head -1)
if [ -z "$jsfiles" ]; then
  rm -rf "$repodir"
  printf "Content-Type: application/json\r\n\r\n"
  printf '{"results":[],"message":"no JS/TS source files found in src/"}\n'
  exit 0
fi

cp /www/eslint.config.js "$repodir/eslint.config.js"

output=$(cd "$repodir" && NODE_PATH=/usr/local/lib/node_modules node /usr/local/lib/node_modules/eslint/bin/eslint.js \
  src/ \
  --no-ignore \
  --format json \
  2>/tmp/eslint_err || true)

rm -rf "$repodir"

if [ -z "$output" ]; then
  printf "Status: 500 Internal Server Error\r\nContent-Type: application/json\r\n\r\n"
  printf '{"error":"eslint produced no output: %s"}\n' "$(cat /tmp/eslint_err | tr '"' "'" | tr '\n' ' ')"
  exit 0
fi

printf "Content-Type: application/json\r\n\r\n"
printf '%s\n' "$output"
