#!/usr/bin/env bash
set -euo pipefail

# Decides whether the pre-release @grafana/e2e-selectors package needs publishing.
# Prints "true" or "false" on stdout; all diagnostics go to stderr.
#
# We publish e2e-selectors as a pre-release only when it has actually changed since
# the last time we published it under the given dist-tag. To avoid an unbounded git
# history fetch (main is very active), we look up the publish time of the last tagged
# release from NPM and deepen the shallow checkout back to that point *by date*.
#
# When we cannot determine the answer confidently we default to publishing, so a
# selector change is never silently withheld from consumers.

PACKAGE="${PACKAGE:-@grafana/e2e-selectors}"
NPM_TAG="${NPM_TAG:-nightly}"
PACKAGE_DIR="${PACKAGE_DIR:-packages/grafana-e2e-selectors}"
GIT_COMMIT="${GRAFANA_COMMIT:-HEAD}"

# Resolve the version currently behind the dist-tag (what plugin e2e follows).
LAST_VERSION="$(npm view --silent "${PACKAGE}@${NPM_TAG}" version 2>/dev/null || true)"
if [ -z "$LAST_VERSION" ]; then
  echo "No existing '${NPM_TAG}' release of ${PACKAGE}; publishing (bootstrap)." >&2
  echo "true"
  exit 0
fi

# Find when that version was published.
PUBLISH_TIME="$(npm view --silent "${PACKAGE}" time --json 2>/dev/null \
  | jq -r --arg v "$LAST_VERSION" '.[$v] // empty')"
if [ -z "$PUBLISH_TIME" ]; then
  echo "Could not resolve publish time for ${PACKAGE}@${LAST_VERSION}; publishing (safe default)." >&2
  echo "true"
  exit 0
fi
echo "Last '${NPM_TAG}' publish: ${PACKAGE}@${LAST_VERSION} at ${PUBLISH_TIME}" >&2

# Deepen only as far back as the last publish (bounded by date, not commit count).
# If we can't deepen the history we can't compare reliably, so publish to be safe.
if ! git fetch --quiet --shallow-since="$PUBLISH_TIME" origin "$GIT_COMMIT" 2>/dev/null; then
  echo "Could not deepen history to ${PUBLISH_TIME}; publishing (safe default)." >&2
  echo "true"
  exit 0
fi

if [ -n "$(git log --since="$PUBLISH_TIME" --format='%H' -- "$PACKAGE_DIR" 2>/dev/null)" ]; then
  echo "${PACKAGE_DIR} changed since ${PUBLISH_TIME}; publishing." >&2
  echo "true"
else
  echo "${PACKAGE_DIR} unchanged since ${PUBLISH_TIME}; skipping publish." >&2
  echo "false"
fi
