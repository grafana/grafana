#!/usr/bin/env bash
set -e

ERROR_COUNT="0"
ACCESSIBILITY_ERRORS="$(grep -oP '\"errors\":(\d+),' pa11y-ci-results.json | grep -oP '\d+')"
DIRECTIVES="$(grep -r -o  directive public/app/ | wc -l)"
CONTROLLERS="$(grep -r -oP 'class .*Ctrl' public/app/ | wc -l)"
LEGACY_FORMS="$(grep -r -oP 'LegacyForms;' public/app | wc -l)"
BARREL_IMPORTS="$(grep -r -oP '@todo: replace barrel import path' public/app | wc -l)"
CLASSNAME_PROP="$(grep -r -o -E --include="*.ts*" "\.*.className=\W.*\W.*" public/app | wc -l)"
EMOTION_IMPORTS="$(grep -r -o -E --include="*.ts*" --exclude="*.test*" "\{.*css.*\} from '@emotion/css'" public/app | wc -l)"
TS_FILES="$(find public/app -type f -name "*.ts*" -not -name "*.test*" | wc -l)"
SCSS_FILES="$(find public packages -name '*.scss' | wc -l)"
OUTDATED_DEPENDENCIES="$(yarn outdated --all | grep -oP '[[:digit:]]+ *(?= dependencies are out of date)')"

echo -e "Typescript errors: $ERROR_COUNT"
echo -e "Accessibility errors: $ACCESSIBILITY_ERRORS"
echo -e "Directives: $DIRECTIVES"
echo -e "Controllers: $CONTROLLERS"
echo -e "Legacy forms: $LEGACY_FORMS"
echo -e "Barrel imports: $BARREL_IMPORTS"
echo -e "Total outdated dependencies: $OUTDATED_DEPENDENCIES"
echo -e "ClassName in props: $CLASSNAME_PROP"
echo -e "@emotion/css imports: $EMOTION_IMPORTS"
echo -e "Total TS files: $TS_FILES"
echo -e "Total SCSS files: $SCSS_FILES"

BETTERER_STATS=""
while read -r name value
do
  BETTERER_STATS+=$'\n  '
  BETTERER_STATS+="\"grafana.ci-code.betterer.${name}\": \"${value}\","
done <<< "$(yarn betterer:stats)"

ESLINT_STATS=""
yarn lint:ts --format ./scripts/cli/eslint-stats-reporter.mjs -o eslint-stats.txt
while read -r name value
do
  ESLINT_STATS+=$'\n  '
  # We still report these as "betterer" as the dashboards/other scripts will still look for it there
  ESLINT_STATS+="\"grafana.ci-code.betterer.${name}\": \"${value}\","
done <<< "$(cat eslint-stats.txt)"

rm eslint-stats.txt

I18N_STATS=""
while read -r name value
do
  I18N_STATS+=$'\n  '
  I18N_STATS+="\"grafana.ci-code.i18n.${name}\": \"${value}\","
done <<< "$(yarn i18n:stats)"

THEME_TOKEN_USAGE=""
while read -r name value
do
  THEME_TOKEN_USAGE+=$'\n  '
  THEME_TOKEN_USAGE+="\"grafana.ci-code.themeUsage.${name}\": \"${value}\","
done <<< "$(yarn themes:usage | awk '$4 == "@grafana/theme-token-usage" {print $3}' | awk '{!seen[$0]++}END{for (i in seen) print i, seen[i]}')"

echo "Metrics: {
  $THEME_TOKEN_USAGE
  $BETTERER_STATS
  $ESLINT_STATS
  $I18N_STATS
  \"grafana.ci-code.strictErrors\": \"${ERROR_COUNT}\",
  \"grafana.ci-code.accessibilityErrors\": \"${ACCESSIBILITY_ERRORS}\",
  \"grafana.ci-code.directives\": \"${DIRECTIVES}\",
  \"grafana.ci-code.controllers\": \"${CONTROLLERS}\",
  \"grafana.ci-code.legacyForms\": \"${LEGACY_FORMS}\",
  \"grafana.ci-code.dependencies.outdated\": \"${OUTDATED_DEPENDENCIES}\",
  \"grafana.ci-code.props.className\": \"${CLASSNAME_PROP}\",
  \"grafana.ci-code.imports.emotion\": \"${EMOTION_IMPORTS}\",
  \"grafana.ci-code.tsFiles\": \"${TS_FILES}\",
  \"grafana.ci-code.scssFiles\": \"${SCSS_FILES}\"
}"
