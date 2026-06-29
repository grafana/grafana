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
  exit 0
fi

# --- ESLint scan ---
eslint_output='[]'
jsfiles=$(find "$repodir/src" -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" 2>/dev/null | head -1)
if [ -n "$jsfiles" ]; then
  cp /www/eslint.config.js "$repodir/eslint.config.js"
  eslint_output=$(cd "$repodir" && NODE_PATH=/usr/local/lib/node_modules node /usr/local/lib/node_modules/eslint/bin/eslint.js \
    src/ \
    --no-ignore \
    --format json \
    2>/tmp/eslint_err || true)
  [ -z "$eslint_output" ] && eslint_output='[]'
fi

# --- npm audit ---
# Generates package-lock.json without installing, then audits against the npm advisory database.
# Covers transitive dependency CVEs not detected by OpenSSF Scorecard's Vulnerabilities check.
npm_output='{}'
if [ -f "$repodir/package.json" ]; then
  cd "$repodir"
  npm install --package-lock-only --silent 2>/tmp/npm_err || true
  if [ -f "$repodir/package-lock.json" ]; then
    npm_output=$(npm audit --json 2>/tmp/npm_audit_err || true)
    [ -z "$npm_output" ] && npm_output='{}'
  fi
fi

rm -rf "$repodir"

printf "Content-Type: application/json\r\n\r\n"
printf '{"eslint":%s,"npmAudit":%s}\n' "$eslint_output" "$npm_output"
