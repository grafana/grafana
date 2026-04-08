#!/bin/bash
#
# Detect endpoint migrations that lack a feature toggle.
#
# Called by the pr-endpoint-feature-toggle workflow and can also be run
# locally to test against any merged or open PR.
#
# Usage:
#   .github/workflows/scripts/test-endpoint-migration-check.sh <PR_NUMBER> [REPO]
#
# Examples:
#   .github/workflows/scripts/test-endpoint-migration-check.sh 119413          # should BLOCK
#   .github/workflows/scripts/test-endpoint-migration-check.sh 121652          # should PASS
#   .github/workflows/scripts/test-endpoint-migration-check.sh 118400          # should PASS
#
set -euo pipefail

PR_NUMBER="${1:?Usage: $0 <PR_NUMBER> [REPO]}"
REPO="${2:-grafana/grafana}"

DIFF=$(gh pr diff "$PR_NUMBER" --repo "$REPO" 2>/dev/null || true)

if [[ -z "$DIFF" ]]; then
  echo "No diff available. Check passed."
  exit 0
fi

# Filter diff to relevant TypeScript files, excluding tests/mocks/generated/infrastructure
FILTERED_DIFF=$(echo "$DIFF" | awk '
  BEGIN { skip = 1 }
  /^diff --git/ {
    skip = 1
    file = $NF
    sub(/^b\//, "", file)
    if (file ~ /\.(ts|tsx)$/ &&
        file !~ /\.(test|spec|stories|gen|mock)\.(ts|tsx)$/ &&
        file !~ /(__mocks__|__tests__|testdata|\/mocks?\/)/ &&
        file !~ /grafana-openapi/ &&
        file !~ /configureStore\.ts$/ &&
        file !~ /core\/reducers\/root\.ts$/)
      skip = 0
  }
  !skip
')

if [[ -z "$FILTERED_DIFF" ]]; then
  echo "No relevant TypeScript changes. Check passed."
  exit 0
fi

# === Signal 1: New K8s API imports (added lines) ===
NEW_K8S_IMPORTS=$(echo "$FILTERED_DIFF" | \
  grep -E '^\+' | \
  grep -vE '^\+\+\+' | \
  grep -E "from\s+['\"]@grafana/api-clients/rtkq/" | \
  grep -vE "@grafana/api-clients/internal/rtkq/legacy" | \
  grep -vE '^\+\s*import\s+type\s' || true)

if [[ -z "$NEW_K8S_IMPORTS" ]]; then
  echo "No new K8s API imports detected. Check passed."
  exit 0
fi

# === Signal 2: Removed API-related code (removed lines) ===
# Detects: getBackendSrv() calls, @grafana/api-clients imports,
# or data-fetching hooks (use*Query, use*Mutation, use*Config)
REMOVED_API=$(echo "$FILTERED_DIFF" | \
  grep -E '^-' | \
  grep -vE '^---' | \
  grep -E "(getBackendSrv\(\)|from\s+['\"]@grafana/api-clients/|use[A-Z][a-zA-Z]*(Query|Mutation|Config)\b)" || true)

if [[ -z "$REMOVED_API" ]]; then
  echo "New K8s API imports found but no old API code removed."
  echo "This looks like a new feature, not a migration. Check passed."
  exit 0
fi

# === Migration detected — check for feature toggle ===
TOGGLE_PRESENT=$(echo "$FILTERED_DIFF" | \
  grep -E '^\+' | \
  grep -vE '^\+\+\+' | \
  grep -E 'config\.featureToggles\.\w+' || true)

if [[ -n "$TOGGLE_PRESENT" ]]; then
  echo "Endpoint migration detected AND feature toggle found. Check passed."
  exit 0
fi

# === Failure ===
echo "::error::This PR migrates API endpoints without a feature toggle."
echo ""
echo "Why this check failed:"
echo "  This PR replaces existing API calls with new K8s API endpoints."
echo "  Frontend deploys to all users at once, but backend rolls out"
echo "  gradually (instant -> fast -> steady -> slow). Without a feature"
echo "  toggle, users on slower channels may hit errors if their backend"
echo "  does not yet serve the new endpoints."
echo ""
echo "New K8s API imports added:"
echo "$NEW_K8S_IMPORTS" | awk '{print "    "$0}'
echo ""
echo "Old API code being removed:"
echo "$REMOVED_API" | awk '{print "    "$0}'
echo ""
echo "How to fix:"
echo "  Gate the migration behind a feature toggle with a fallback:"
echo ""
echo "    import { config } from '@grafana/runtime';"
echo ""
echo "    if (config.featureToggles.yourFeatureFlag) {"
echo "      // Use new K8s API endpoint"
echo "    } else {"
echo "      // Keep existing API call as fallback"
echo "    }"
echo ""
echo "  If a toggle is not needed (e.g., the backend endpoint is already"
echo "  fully rolled out on all channels), add the label:"
echo "  'no-check-endpoint-feature-toggle'"
echo ""
echo "For details: https://enghub.grafana-ops.net/docs/default/component/deployment-tools/grafana-frontend-service/"
exit 1
