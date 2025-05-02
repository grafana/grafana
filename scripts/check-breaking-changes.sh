#!/usr/bin/env bash

# Find package directories
PACKAGES=$(ls -d ./packages/*/)
EXIT_CODE=0
GITHUB_MESSAGE=""
SKIP_PACKAGES=("grafana-eslint-rules" "grafana-plugin-configs" "grafana-o11y-ds-frontend" "grafana-sql")

# Loop through the packages
while IFS=" " read -r -a package; do

  # shellcheck disable=SC2128
  PACKAGE_PATH=$(basename "$package")

  # Calculate current and previous package paths / names
  PREV="./base/$PACKAGE_PATH"
  CURRENT="./pr/$PACKAGE_PATH"

  # Temporarily skipping these packages as they don't have any exposed static typing
  SKIP_PACKAGE_FOUND=0
  for skip_pkg in "${SKIP_PACKAGES[@]}"; do
    if [[ "$PACKAGE_PATH" == "$skip_pkg" ]]; then
      SKIP_PACKAGE_FOUND=1
      break
    fi
  done

  if [[ $SKIP_PACKAGE_FOUND -eq 1 ]]; then
    continue
  fi

  # Skip packages that are marked as private in their package.json (private: true)
  if [[ $(jq -r '.private' "./packages/$PACKAGE_PATH/package.json") == "true" ]]; then
    continue
  fi

  # Extract the npm package tarballs into separate directories e.g. ./base/@grafana-data.tgz -> ./base/grafana-data/
  mkdir "$PREV"
  tar -xf "./base/@$PACKAGE_PATH.tgz" --strip-components=1 -C "$PREV"
  mkdir "$CURRENT"
  tar -xf "./pr/@$PACKAGE_PATH.tgz" --strip-components=1 -C "$CURRENT"

  # Run the comparison and record the exit code
  echo ""
  echo ""
  echo "$PACKAGE_PATH"
  echo "================================================="
  npm exec -- @grafana/levitate@latest compare --prev "$PREV" --current "$CURRENT" --json >data.json

  # Check if the comparison returned with a non-zero exit code
  # Record the output, maybe with some additional information
  STATUS=$?
  CURRENT_REPORT=$(node ./scripts/levitate-parse-json-report.js)
  # Final exit code
  # (non-zero if any of the packages failed the checks)
  if [ "$STATUS" -gt 0 ]; then
    EXIT_CODE=1
    GITHUB_MESSAGE="${GITHUB_MESSAGE}**<code>${PACKAGE_PATH}</code>** has possible breaking changes<br />"
    GITHUB_LEVITATE_MARKDOWN+="<h3>${PACKAGE_PATH}</h3>${CURRENT_REPORT}<br>"
  fi

done <<<"$PACKAGES"

# "Export" the message to an environment variable that can be used across Github Actions steps
echo "is_breaking=$EXIT_CODE" >>"$GITHUB_OUTPUT"
echo "message=$GITHUB_MESSAGE" >>"$GITHUB_OUTPUT"
mkdir -p ./levitate
echo "$GITHUB_LEVITATE_MARKDOWN" >./levitate/levitate.md

# We will exit the workflow accordingly at another step
exit 0
