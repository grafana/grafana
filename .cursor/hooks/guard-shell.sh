#!/usr/bin/env bash
# beforeShellExecution — deny obvious foot-guns; allow everything else (fail-open).
set -euo pipefail

INPUT="$(cat || true)"

allow() {
  printf '%s\n' '{"permission":"allow"}'
  exit 0
}

deny() {
  local reason="$1"
  jq -n --arg msg "$reason" '{permission:"deny",user_message:$msg,agent_message:$msg}'
  exit 0
}

if [[ -z "$INPUT" ]]; then
  allow
fi

if ! command -v jq >/dev/null 2>&1; then
  allow
fi

COMMAND="$(printf '%s' "$INPUT" | jq -r '.command // empty' 2>/dev/null || true)"
if [[ -z "$COMMAND" ]]; then
  allow
fi

# Force push (including -f / --force-with-lease variants used as force push)
if printf '%s' "$COMMAND" | grep -Eqi '(^|[[:space:];|&])git[[:space:]]+push[[:space:]]+.*(--force|-f)([[:space:]]|$)'; then
  deny "Blocked by project hook: git force-push is not allowed from the agent shell."
fi

# Destructive rm targeting filesystem roots or home
if printf '%s' "$COMMAND" | grep -Eqi '(^|[[:space:];|&])rm[[:space:]]+(-[a-zA-Z]*f[a-zA-Z]*|--force).*[[:space:]](/|~)([[:space:]]|$)'; then
  deny "Blocked by project hook: destructive rm against / or ~ is not allowed from the agent shell."
fi

if printf '%s' "$COMMAND" | grep -Eqi '(^|[[:space:];|&])rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*).*[[:space:]](/|~|\.\.)(/|[[:space:]]|$)'; then
  deny "Blocked by project hook: recursive force-rm against sensitive paths is not allowed from the agent shell."
fi

allow
