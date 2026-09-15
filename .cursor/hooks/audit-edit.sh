#!/usr/bin/env bash
# afterFileEdit — observe agent edits (fail-open).
set -euo pipefail

LOG_FILE="${CURSOR_HOOKS_AUDIT_LOG:-.cursor/hooks-audit.log}"
INPUT="$(cat || true)"

if [[ -z "$INPUT" ]]; then
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.file_path // empty' 2>/dev/null || true)"
if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

mkdir -p "$(dirname "$LOG_FILE")"
printf '%s\tafterFileEdit\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FILE_PATH" >>"$LOG_FILE"
exit 0
