#!/bin/bash
# Normalize the GitHub App PEM private key from env into a parseable multiline PEM.
# Cloud secret stores often flatten multiline PEMs to a single line: literal \n
# escapes, newlines replaced by spaces, or base64 of the whole PEM file.
# Prints the normalized PEM to stdout — and nothing else. Diagnostics go to
# stderr and never include key material.
# Usage: pem=$(bash .claude/skills/git-sync/shared/scripts/normalize-pem.sh)
set -euo pipefail
{ set +x; } 2>/dev/null # never trace key material, even if xtrace was inherited

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

# Valid iff openssl parses it as a private key (PKCS#1 or PKCS#8).
# Key reaches openssl via stdin only — never as an argument.
valid() {
  printf '%s\n' "$1" | openssl pkey -noout 2>/dev/null
}

# Rebuild a PEM whose newlines were replaced by single spaces:
# "-----BEGIN RSA PRIVATE KEY----- MII... ... -----END RSA PRIVATE KEY-----"
# Header/footer keep their interior spaces; every body space was a newline.
rebuild_spaces() {
  local re='^(-----BEGIN [A-Z0-9 ]+-----) (.*) (-----END [A-Z0-9 ]+-----) ?$'
  if [[ "$1" =~ $re ]]; then
    printf '%s\n%s\n%s\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]// /$'\n'}" "${BASH_REMATCH[3]}"
  fi
}

# Try the whitespace variants of one candidate value, in order.
try_variants() {
  local v="$1" candidate
  if valid "$v"; then printf '%s\n' "$v"; return 0; fi
  candidate=$(printf '%b' "$v")            # literal \n escapes
  if valid "$candidate"; then printf '%s\n' "$candidate"; return 0; fi
  candidate=$(rebuild_spaces "$v")          # newlines flattened to spaces
  if [ -n "$candidate" ] && valid "$candidate"; then printf '%s\n' "$candidate"; return 0; fi
  return 1
}

main() {
  local raw=""
  local key_path="${GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH:-}"
  local key_inline="${GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY:-}"

  if [ -n "$key_path" ] && [ -f "$key_path" ]; then
    raw=$(cat "$key_path")
  elif [ -n "$key_inline" ]; then
    [ -n "$key_path" ] && echo "WARNING: PEM file not found at $key_path; falling back to GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY" >&2
    raw="$key_inline"
  elif [ -n "$key_path" ]; then
    fail "PEM file not found at $key_path and GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY is not set"
  else
    fail "Neither GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH nor GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY is set"
  fi

  if try_variants "$raw"; then return 0; fi

  # Base64 of the entire PEM (only plausible when no BEGIN header is visible).
  if [[ "$raw" != *"-----BEGIN"* ]]; then
    local decoded
    if decoded=$(printf '%s' "$raw" | openssl base64 -d -A 2>/dev/null) && [ -n "$decoded" ]; then
      if try_variants "$decoded"; then return 0; fi
    fi
  fi

  fail "Private key is not parseable as raw, \\n-escaped, space-flattened, or base64-encoded PEM (validated with 'openssl pkey -noout')"
}

main
