#!/usr/bin/env bash
set -euo pipefail

# Decides whether the pre-release @grafana/e2e-selectors package needs publishing.
# Prints "true" or "false" on stdout; all diagnostics go to stderr.
#
# We anchor on the exact source commit of the last published artifact rather than on
# wall-clock time: npm records `gitHead` in the packument, so `npm view <pkg>@<tag>
# gitHead` yields the SHA the published tarball was built from. Comparing the package
# directory between that commit and the commit being built is exact - no date fuzz and
# no shallow-clone graft/boundary edge cases. `git diff` needs only the two commit
# snapshots (not the history between them), so it works in a shallow checkout once the
# previous commit is fetched.
#
# We fail open (publish) whenever the answer can't be determined confidently - no
# published version yet, no recorded gitHead, or any git failure - so a real selector
# change is never silently withheld from consumers.

PACKAGE="${PACKAGE:-@grafana/e2e-selectors}"
NPM_TAG="${NPM_TAG:-nightly}"
PACKAGE_DIR="${PACKAGE_DIR:-packages/grafana-e2e-selectors}"
GIT_COMMIT="${GRAFANA_COMMIT:-HEAD}"

# gitHead (source SHA) of the version currently behind the dist-tag.
PREV_SHA="$(npm view --silent "${PACKAGE}@${NPM_TAG}" gitHead 2>/dev/null || true)"
if [ -z "$PREV_SHA" ]; then
  echo "No published '${NPM_TAG}' gitHead for ${PACKAGE}; publishing (fail open)." >&2
  echo "true"
  exit 0
fi
echo "Last '${NPM_TAG}' publish of ${PACKAGE} was built from ${PREV_SHA}." >&2

# Ensure the previous commit is available locally. Fetch just that commit if missing;
# never use --depth on a complete clone (that would truncate it into a shallow one).
if ! git cat-file -e "${PREV_SHA}^{commit}" 2>/dev/null; then
  if [ "$(git rev-parse --is-shallow-repository 2>/dev/null)" = "true" ]; then
    git fetch --quiet --depth=1 origin "$PREV_SHA" 2>/dev/null || true
  else
    git fetch --quiet origin "$PREV_SHA" 2>/dev/null || true
  fi
fi

if ! git rev-parse -q --verify "${PREV_SHA}^{commit}" >/dev/null 2>&1; then
  echo "Could not resolve ${PREV_SHA} locally; publishing (fail open)." >&2
  echo "true"
  exit 0
fi

# Compare the package directory between the two commits.
# git diff --quiet exits 0 (identical), 1 (differs), or >1 (error -> fail open).
set +e
git diff --quiet "$PREV_SHA" "$GIT_COMMIT" -- "$PACKAGE_DIR"
STATUS=$?
set -e

case "$STATUS" in
  0)
    echo "${PACKAGE_DIR} unchanged since ${PREV_SHA}; skipping publish." >&2
    echo "false"
    ;;
  1)
    echo "${PACKAGE_DIR} changed since ${PREV_SHA}; publishing. Changed files:" >&2
    git diff --stat "$PREV_SHA" "$GIT_COMMIT" -- "$PACKAGE_DIR" >&2 || true
    echo "true"
    ;;
  *)
    echo "git diff failed (status ${STATUS}); publishing (fail open)." >&2
    echo "true"
    ;;
esac
