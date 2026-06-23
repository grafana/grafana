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

output=$(/usr/local/bin/scorecard --repo="$repo" --format=json 2>/tmp/scorecard_err)
if [ -z "$output" ]; then
  printf "Status: 500 Internal Server Error\r\nContent-Type: application/json\r\n\r\n"
  printf '{"error":"%s"}\n' "$(cat /tmp/scorecard_err | tr '"' "'")"
  exit 0
fi

printf "Content-Type: application/json\r\n\r\n"
printf '%s\n' "$output"
