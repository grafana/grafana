#!/bin/bash
set -e

ERROR_COUNT="$(yarn run tsc --project tsconfig.json --noEmit --strict true | grep -oP 'Found \K(\d+)')"
DIRECTIVES="$(grep -r -o  directive public/app/ | wc -l)"
CONTROLLERS="$(grep -r -oP 'class .*Ctrl' public/app/ | wc -l)"
STORIES_COUNT="$(find ./packages/grafana-ui/src/components -name "*.story.tsx" | wc -l)"
MDX_COUNT="$(find ./packages/grafana-ui/src/components -name "*.mdx" | wc -l)"
LEGACY_FORMS="$(grep -r -oP 'LegacyForms;' public/app | wc -l)"

STRICT_LINT_RESULTS="$(yarn run eslint --rule '@typescript-eslint/no-explicit-any: ["error"]' --format unix ./public/ || true)"
STRICT_LINT_EXPLICIT_ANY="$(echo "${STRICT_LINT_RESULTS}" | grep -o "no-explicit-any" | wc -l)"

OUTDATED_DEPENDENCIES="$(yarn outdated | wc -l | xargs)"
VULNERABILITY_AUDIT="$(yarn audit | grep 'Severity:' | grep -Eo '[0-9]{1,4}')"
LOW_VULNERABILITIES="$(echo $VULNERABILITY_AUDIT | cut -d' ' -f1)"
MED_VULNERABILITIES="$(echo $VULNERABILITY_AUDIT | cut -d' ' -f2)"
HIGH_VULNERABILITIES="$(echo $VULNERABILITY_AUDIT | cut -d' ' -f3)"

echo -e "Typescript errors: $ERROR_COUNT"
echo -e "Directives: $DIRECTIVES"
echo -e "Controllers: $CONTROLLERS"
echo -e "Stories: $STORIES_COUNT"
echo -e "Documented stories: $MDX_COUNT"
echo -e "Legacy forms: $LEGACY_FORMS"
echo -e "TS Explicit any: $STRICT_LINT_EXPLICIT_ANY"
echo -e "low vulnerabilities: $LOW_VULNERABILITIES"
echo -e "med vulnerabilities: $MED_VULNERABILITIES"
echo -e "high vulnerabilities: $HIGH_VULNERABILITIES"
echo -e "total outdated depdendencies: $OUTDATED_DEPENDENCIES"

echo "Metrics: {
  \"grafana.ci-code.strictErrors\": \"${ERROR_COUNT}\",
  \"grafana.ci-code.directives\": \"${DIRECTIVES}\",
  \"grafana.ci-code.controllers\": \"${CONTROLLERS}\",
  \"grafana.ci-code.grafana-ui.stories\": \"${STORIES_COUNT}\",
  \"grafana.ci-code.grafana-ui.mdx\": \"${MDX_COUNT}\",
  \"grafana.ci-code.legacyForms\": \"${LEGACY_FORMS}\",
  \"grafana.ci-code.strictLint.noExplicitAny\": \"${STRICT_LINT_EXPLICIT_ANY}\"
  \"grafana.ci-code.dependencies.outdated\": \"${OUTDATED_DEPENDENCIES}\",
  \"grafana.ci-code.dependencies.lowVulnerabilities\": \"${LOW_VULNERABILITIES}\",
  \"grafana.ci-code.dependencies.mediumVulnerabilities\": \"${MED_VULNERABILITIES}\",
  \"grafana.ci-code.dependencies.highVulnerabilities\": \"${HIGH_VULNERABILITIES}\",
}"
