#!/bin/bash
# Source .env from the project root and export all variables.
# Usage: source .cursor/skills/git-sync-shared/scripts/load-env.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

fail() {
  echo "ERROR: $1" >&2
  # shellcheck disable=SC2317
  return 1 2>/dev/null || exit 1
}

warn_partial_flow() {
  local name="$1"
  shift
  local missing=("$@")

  echo "WARNING: Partial $name config detected. Missing vars:" >&2
  local var
  for var in "${missing[@]}"; do
    echo "  - $var" >&2
  done
}

if [ ! -f "$ENV_FILE" ]; then
  echo "Copy .env.example to .env and fill in your credentials." >&2
  fail ".env file not found at $ENV_FILE"
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

complete_flows=()

check_flow() {
  local name="$1"
  shift
  local vars=("$@")
  local set_count=0
  local missing=()
  local var

  for var in "${vars[@]}"; do
    if [ -n "${!var:-}" ]; then
      set_count=$((set_count + 1))
    else
      missing+=("$var")
    fi
  done

  if [ "$set_count" -eq 0 ]; then
    return 0
  fi

  if [ "$set_count" -eq "${#vars[@]}" ]; then
    complete_flows+=("$name")
    return 0
  fi

  warn_partial_flow "$name" "${missing[@]}"
}

check_github_app_flow() {
  local name="GitHub App"
  local base_vars=(
    GIT_SYNC_TEST_APP_REPO_URL
    GIT_SYNC_TEST_GITHUB_APP_ID
    GIT_SYNC_TEST_GITHUB_APP_INSTALLATION_ID
  )
  local set_count=0
  local missing=()
  local var

  for var in "${base_vars[@]}"; do
    if [ -n "${!var:-}" ]; then
      set_count=$((set_count + 1))
    else
      missing+=("$var")
    fi
  done

  local key_path="${GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH:-}"
  local key_inline="${GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY:-}"
  local has_key=0
  if [ -n "$key_path" ] || [ -n "$key_inline" ]; then
    has_key=1
  fi

  local has_any=0
  if [ "$set_count" -gt 0 ] || [ "$has_key" -eq 1 ]; then
    has_any=1
  fi

  if [ "$has_any" -eq 0 ]; then
    return 0
  fi

  if [ "$set_count" -eq "${#base_vars[@]}" ] && [ "$has_key" -eq 1 ]; then
    complete_flows+=("$name")
    return 0
  fi

  if [ "$has_key" -eq 0 ]; then
    missing+=("one of GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH or GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY")
  fi

  warn_partial_flow "$name" "${missing[@]}"
}

check_flow "GitHub PAT" GIT_SYNC_TEST_PAT_REPO_URL GIT_SYNC_TEST_PAT
check_flow "GitLab token" GIT_SYNC_TEST_GITLAB_REPO_URL GIT_SYNC_TEST_GITLAB_TOKEN
check_flow "Bitbucket token" GIT_SYNC_TEST_BITBUCKET_REPO_URL GIT_SYNC_TEST_BITBUCKET_TOKEN GIT_SYNC_TEST_BITBUCKET_TOKEN_USER
check_github_app_flow

if [ ${#complete_flows[@]} -eq 0 ]; then
  fail "No complete git-sync credential set found in $ENV_FILE. Set one of: GitHub PAT, GitLab token, Bitbucket token, or GitHub App variables."
fi

if [ -n "${GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH:-}" ] && [ ! -f "${GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH}" ]; then
  echo "WARNING: PEM file not found at $GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH" >&2
fi

configured_flows=$(printf '%s, ' "${complete_flows[@]}")
configured_flows=${configured_flows%, }

echo "Environment loaded. Configured flows: $configured_flows"
