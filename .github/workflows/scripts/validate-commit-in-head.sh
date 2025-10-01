#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${GIT_COMMIT:-}" ]]; then
  echo "Error: Environment variable GIT_COMMIT is required"
  exit 1
fi

if git merge-base --is-ancestor "$GIT_COMMIT" HEAD; then
  echo "Commit $GIT_COMMIT is contained in HEAD"
else
  echo "Error: Commit $GIT_COMMIT is not contained in HEAD"
  exit 1
fi
