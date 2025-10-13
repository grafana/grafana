#!/usr/bin/env bash
set -e

BUILD_FOLDER=$1
if [ -z "$BUILD_FOLDER" ]; then
  BUILD_FOLDER="./public/build"
fi

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

TOTAL_BUNDLE="$(du -sk "$BUILD_FOLDER" | cut -f1)"
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
echo -e "Legacy forms: $LEGACY_FORMS"
echo -e "Barrel imports: $BARREL_IMPORTS"
echo -e "Total bundle folder size: $TOTAL_BUNDLE"
echo -e "Total outdated dependencies: $OUTDATED_DEPENDENCIES"
echo -e "Low vulnerabilities: $LOW_VULNERABILITIES"
echo -e "Med vulnerabilities: $MED_VULNERABILITIES"
echo -e "High vulnerabilities: $HIGH_VULNERABILITIES"
echo -e "Critical vulnerabilities: $CRITICAL_VULNERABILITIES"
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
  $I18N_STATS
  \"grafana.ci-code.strictErrors\": \"${ERROR_COUNT}\",
  \"grafana.ci-code.accessibilityErrors\": \"${ACCESSIBILITY_ERRORS}\",
  \"grafana.ci-code.directives\": \"${DIRECTIVES}\",
  \"grafana.ci-code.controllers\": \"${CONTROLLERS}\",
  \"grafana.ci-code.legacyForms\": \"${LEGACY_FORMS}\",
  \"grafana.ci-code.bundleFolderSize\": \"${TOTAL_BUNDLE}\",
  \"grafana.ci-code.dependencies.outdated\": \"${OUTDATED_DEPENDENCIES}\",
  \"grafana.ci-code.props.className\": \"${CLASSNAME_PROP}\",
  \"grafana.ci-code.imports.emotion\": \"${EMOTION_IMPORTS}\",
  \"grafana.ci-code.tsFiles\": \"${TS_FILES}\",
  \"grafana.ci-code.scssFiles\": \"${SCSS_FILES}\"
}"
