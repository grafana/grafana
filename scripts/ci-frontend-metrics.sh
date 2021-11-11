#!/bin/bash
set -e

ERROR_COUNT="0"
ACCESSIBILITY_ERRORS="$(grep -oP '\"errors\":(\d+),' pa11y-ci-results.json | grep -oP '\d+')"
DIRECTIVES="$(grep -r -o  directive public/app/ | wc -l)"
CONTROLLERS="$(grep -r -oP 'class .*Ctrl' public/app/ | wc -l)"
STORIES_COUNT="$(find ./packages/grafana-ui/src/components -name "*.story.tsx" | wc -l)"
MDX_COUNT="$(find ./packages/grafana-ui/src/components -name "*.mdx" | wc -l)"
LEGACY_FORMS="$(grep -r -oP 'LegacyForms;' public/app | wc -l)"

STRICT_LINT_RESULTS="$(yarn run eslint --rule '@typescript-eslint/no-explicit-any: ["error"]' --format unix --ext .ts,.tsx ./public || true)"
STRICT_LINT_EXPLICIT_ANY="$(echo "${STRICT_LINT_RESULTS}" | grep -o "no-explicit-any" | wc -l)"

TOTAL_BUNDLE="$(du -sk ./public/build | cut -f1)"
OUTDATED_DEPENDENCIES="$(yarn outdated --all | grep -oP '[[:digit:]]+ *(?= dependencies are out of date)')"
## Disabled due to yarn PnP update breaking npm audit
#VULNERABILITY_AUDIT="$(yarn npm audit --all --recursive --json)"
#LOW_VULNERABILITIES="$(echo "${VULNERABILITY_AUDIT}" | grep -o -i '"severity":"low"' | wc -l)"
#MED_VULNERABILITIES="$(echo "${VULNERABILITY_AUDIT}" | grep -o -i '"severity":"moderate"' | wc -l)"
#HIGH_VULNERABILITIES="$(echo "${VULNERABILITY_AUDIT}" | grep -o -i '"severity":"high"' | wc -l)"
#CRITICAL_VULNERABILITIES="$(echo "${VULNERABILITY_AUDIT}" | grep -o -i '"severity":"critical"' | wc -l)"

echo -e "Typescript errors: $ERROR_COUNT"
echo -e "Accessibility errors: $ACCESSIBILITY_ERRORS"
echo -e "Directives: $DIRECTIVES"
echo -e "Controllers: $CONTROLLERS"
echo -e "Stories: $STORIES_COUNT"
echo -e "Documented stories: $MDX_COUNT"
echo -e "Legacy forms: $LEGACY_FORMS"
echo -e "TS Explicit any: $STRICT_LINT_EXPLICIT_ANY"
echo -e "Total bundle folder size: $TOTAL_BUNDLE"
echo -e "Total outdated dependencies: $OUTDATED_DEPENDENCIES"
echo -e "Low vulnerabilities: $LOW_VULNERABILITIES"
echo -e "Med vulnerabilities: $MED_VULNERABILITIES"
echo -e "High vulnerabilities: $HIGH_VULNERABILITIES"
echo -e "Critical vulnerabilities: $CRITICAL_VULNERABILITIES"

echo "Metrics: {
  \"grafana.ci-code.strictErrors\": \"${ERROR_COUNT}\",
  \"grafana.ci-code.accessibilityErrors\": \"${ACCESSIBILITY_ERRORS}\",
  \"grafana.ci-code.directives\": \"${DIRECTIVES}\",
  \"grafana.ci-code.controllers\": \"${CONTROLLERS}\",
  \"grafana.ci-code.grafana-ui.stories\": \"${STORIES_COUNT}\",
  \"grafana.ci-code.grafana-ui.mdx\": \"${MDX_COUNT}\",
  \"grafana.ci-code.legacyForms\": \"${LEGACY_FORMS}\",
  \"grafana.ci-code.strictLint.noExplicitAny\": \"${STRICT_LINT_EXPLICIT_ANY}\",
  \"grafana.ci-code.bundleFolderSize\": \"${TOTAL_BUNDLE}\",
  \"grafana.ci-code.dependencies.outdated\": \"${OUTDATED_DEPENDENCIES}\",
  \"grafana.ci-code.dependencies.vulnerabilities.low\": \"${LOW_VULNERABILITIES}\",
  \"grafana.ci-code.dependencies.vulnerabilities.medium\": \"${MED_VULNERABILITIES}\",
  \"grafana.ci-code.dependencies.vulnerabilities.high\": \"${HIGH_VULNERABILITIES}\",
  \"grafana.ci-code.dependencies.vulnerabilities.critical\": \"${CRITICAL_VULNERABILITIES}\"
}"
