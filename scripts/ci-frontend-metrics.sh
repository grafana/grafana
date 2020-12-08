#!/bin/bash
set -e

ERROR_COUNT="$(./node_modules/.bin/tsc --project tsconfig.json --noEmit --strict true | grep -oP 'Found \K(\d+)')"
DIRECTIVES="$(grep -r -o  directive public/app/ | wc -l)"
CONTROLLERS="$(grep -r -oP 'class .*Ctrl' public/app/ | wc -l)"
STORIES_COUNT="$(find ./packages/grafana-ui/src/components -name "*.story.tsx" | wc -l)"
MDX_COUNT="$(find ./packages/grafana-ui/src/components -name "*.mdx" | wc -l)"
LEGACY_FORMS="$(grep -r -oP 'LegacyForms;' public/app | wc -l)"

echo -e "Typescript errors: $ERROR_COUNT"
echo -e "Directives: $DIRECTIVES"
echo -e "Controllers: $CONTROLLERS"
echo -e "Stories: $STORIES_COUNT"
echo -e "Documented stories: $MDX_COUNT"
echo -e "Legacy forms: $LEGACY_FORMS"

echo "Metrics: {
  \"grafana.ci-code.strictErrors\": \"${ERROR_COUNT}\",
  \"grafana.ci-code.directives\": \"${DIRECTIVES}\",
  \"grafana.ci-code.controllers\": \"${CONTROLLERS}\",
  \"grafana.ci-code.grafana-ui.stories\": \"${STORIES_COUNT}\",
  \"grafana.ci-code.grafana-ui.mdx\": \"${MDX_COUNT}\",
  \"grafana.ci-code.legacyForms\": \"${LEGACY_FORMS}\"
}"
