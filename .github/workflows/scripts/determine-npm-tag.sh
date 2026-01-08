#!/usr/bin/env bash
set -euo pipefail

fail() { echo "Error: $*" >&2; exit 1; }

# Ensure required variables are set
if [[ -z "${REFERENCE_PKG}" || -z "${VERSION_TYPE}" || -z "${VERSION}" ]]; then
  fail "Missing required environment variables: REFERENCE_PKG, VERSION_TYPE, VERSION"
fi

semver_cmp () {
  IFS='.' read -r -a arr_a <<< "$1"
  IFS='.' read -r -a arr_b <<< "$2"

  for i in 0 1 2; do
    local aa=${arr_a[i]:-0}
    local bb=${arr_b[i]:-0}
    # shellcheck disable=SC2004
    if (( 10#$aa > 10#$bb )); then echo gt; return 0; fi
    if (( 10#$aa < 10#$bb )); then echo lt; return 0; fi
  done

  echo "eq"
}


STABLE_REGEX='^([0-9]+)\.([0-9]+)\.([0-9]+)$'       # x.y.z
PRE_REGEX='^([0-9]+)\.([0-9]+)\.([0-9]+)-([0-9]+)$' # x.y.z-123456

# Validate that the VERSION matches VERSION_TYPE
# - stable must be x.y.z
# - nightly/canary must be x.y.z-123456
case "$VERSION_TYPE" in
  stable)
    [[ $VERSION =~ $STABLE_REGEX ]] || fail "For 'stable', version must match x.y.z" ;;
  nightly|canary)
    [[ $VERSION =~ $PRE_REGEX   ]] || fail "For '$VERSION_TYPE', version must match x.y.z-123456" ;;
  *)
    fail "Unknown version_type '$VERSION_TYPE'" ;;
esac

# Extract major, minor from VERSION
IFS=.- read -r major minor patch _ <<< "$VERSION"

# Determine NPM tag
case "$VERSION_TYPE" in
  canary)  TAG="canary" ;;
  nightly) TAG="nightly" ;;
  stable)
    # Use npm dist-tag "latest" as the reference
    LATEST="$(npm view --silent "$REFERENCE_PKG" dist-tags.latest 2>/dev/null || true)"
    echo "Latest for $REFERENCE_PKG is ${LATEST:-<none>}" >&2

    if [[ -z ${LATEST:-} ]]; then
      TAG="latest"  # first ever publish
    else
      case "$(semver_cmp "$VERSION" "$LATEST")" in
        gt)    TAG="latest" ;;                      # newer than reference -> latest
        lt|eq) TAG="v${major}.${minor}-latest" ;;   # older or equal -> vX.Y-latest
      esac
    fi
    ;;
esac

echo "Resolved NPM_TAG=$TAG (VERSION=$VERSION, current latest=${LATEST:-none})"  1>&2 # stderr
printf '%s' "$TAG"
