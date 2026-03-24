#!/bin/bash
# Source .env from the project root and export all variables.
# Usage: source .cursor/skills/test-git-sync-provisioning/scripts/load-env.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env file not found at $ENV_FILE" >&2
  echo "Copy .env.example to .env and fill in your credentials." >&2
  # shellcheck disable=SC2317
  return 1 2>/dev/null || exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

# Validate required vars
missing=()
[ -z "${GIT_SYNC_TEST_PAT_REPO_URL:-}" ] && missing+=("GIT_SYNC_TEST_PAT_REPO_URL")
[ -z "${GIT_SYNC_TEST_PAT:-}" ] && missing+=("GIT_SYNC_TEST_PAT")

if [ ${#missing[@]} -gt 0 ]; then
  echo "ERROR: Missing required environment variables: ${missing[*]}" >&2
  # shellcheck disable=SC2317
  return 1 2>/dev/null || exit 1
fi

# Validate optional GitHub App vars (warn if partial)
app_vars=(GIT_SYNC_TEST_APP_REPO_URL GIT_SYNC_TEST_GITHUB_APP_ID GIT_SYNC_TEST_GITHUB_APP_INSTALLATION_ID GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH)
app_set=0
for var in "${app_vars[@]}"; do
  [ -n "${!var:-}" ] && ((app_set++))
done

if [ "$app_set" -gt 0 ] && [ "$app_set" -lt 4 ]; then
  echo "WARNING: Partial GitHub App config detected. Set all 4 vars for the GitHub App flow:" >&2
  for var in "${app_vars[@]}"; do
    [ -z "${!var:-}" ] && echo "  - $var" >&2
  done
fi

# Validate PEM file exists if path is set
if [ -n "${GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH:-}" ] && [ ! -f "${GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH}" ]; then
  echo "WARNING: PEM file not found at $GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH" >&2
fi

echo "Environment loaded. PAT repo: $GIT_SYNC_TEST_PAT_REPO_URL"
