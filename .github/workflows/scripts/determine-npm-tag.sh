#!/usr/bin/env bash
set -euo pipefail

# Ensure required variables are set
if [[ -z "${REFERENCE_PKG}" || -z "${VERSION_TYPE}" || -z "${VERSION}" ]]; then
  echo "Missing required environment variables: REFERENCE_PKG, VERSION_TYPE, VERSION" >&2
  exit 1
fi

semver_cmp () {
  IFS='.' read -r -a arr_a <<< "$1"
  IFS='.' read -r -a arr_b <<< "$2"

  for i in 0 1 2; do
    a_segment="${arr_a[i]:-0}"
    b_segment="${arr_b[i]:-0}"
    if [[ "$a_segment" > "$b_segment" ]]; then
      echo "gt"
      return 0
    fi
    if [[ "$a_segment" < "$b_segment" ]]; then
      echo "lt"
      return 0
    fi
  done

  echo "eq"
}

# Regex for x.y.z
STABLE_REGEX='^([0-9]+)\.([0-9]+)\.([0-9]+)$'

# Regex for x.y.z-123456
PRE_REGEX='^([0-9]+)\.([0-9]+)\.([0-9]+)-([0-9]+)$'

# First validate that the VERSION matches VERSION_TYPE
# - stable must be x.y.z
# - nightly/canary must be x.y.z-123456
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

major=$(echo "$VERSION" | cut -d. -f1)
minor=$(echo "$VERSION" | cut -d. -f2)

case "$VERSION_TYPE" in
  canary)  TAG="canary" ;;
  nightly) TAG="nightly" ;;
  stable)
    LATEST="$(npm view "$REFERENCE_PKG" dist-tags.latest 2>/dev/null || true)"

    echo "Latest for $REFERENCE_PKG is $LATEST" 1>&2 # stderr

    if [[ -z "${LATEST:-}" ]]; then
      # First ever publish - set to latest
      TAG="latest"
    else
      cmp_result=$(semver_cmp "$VERSION" "$LATEST")
      case $cmp_result in
        "gt") TAG="latest" ;; # Input version is greator than latest of reference package -> TAG=latest
        "lt"|"eq") TAG="v$major.$minor-latest" ;; # Input version is equal, or it's a prev version -> TAG=major.minor-latest
      esac
    fi
    ;;
  *) echo "Unknown version_type: $VERSION_TYPE" >&2; exit 1 ;;
esac

echo "Resolved NPM_TAG=$TAG (VERSION=$VERSION, current latest=${LATEST:-none})"  1>&2 # stderr

echo "$TAG"
