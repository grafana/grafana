#!/usr/bin/env bash
set -euo pipefail

# Regex for x.y.z
STABLE_REGEX='^([0-9]+)\.([0-9]+)\.([0-9]+)$'

# Regex for x.y.z-123456
PRE_REGEX='^([0-9]+)\.([0-9]+)\.([0-9]+)-([0-9]+)$'

if [[ -z "$VERSION_TYPE" || -z "$VERSION" ]]; then
  echo "Error: Environment variables VERSION_TYPE and VERSION are required"
  exit 1
fi

if [[ "$VERSION_TYPE" == "stable" ]]; then
  if [[ ! "$VERSION" =~ $STABLE_REGEX ]]; then
    echo "Error: For 'stable', version must match x.y.z"
    exit 1
  fi
elif [[ "$VERSION_TYPE" == "nightly" || "$VERSION_TYPE" == "canary" ]]; then
  if [[ ! "$VERSION" =~ $PRE_REGEX ]]; then
    echo "Error: For '$VERSION_TYPE', version must match x.y.z-123456"
    exit 1
  fi
else
  echo "Error: Unknown version_type '$VERSION_TYPE'"
  exit 1
fi
