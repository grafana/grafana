#!/usr/bin/env bash

# Find package directories
PACKAGES=$(ls -d ./packages/*/)
EXIT_CODE=0
GITHUB_MESSAGE=""

# Loop through the packages
while IFS=" " read -r -a package; do

    # shellcheck disable=SC2128
    PACKAGE_PATH=$(basename "$package")

    # Calculate current and previous package paths / names
    PREV="./base/$PACKAGE_PATH"
    CURRENT="./pr/$PACKAGE_PATH"

    # Temporarily skipping these packages as they don't have any exposed static typing
    if [[ "$PACKAGE_PATH" == 'grafana-eslint-rules' ]]; then
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
    echo "${PACKAGE_PATH}"
    echo "================================================="
    npm exec -- @grafana/levitate compare --prev "$PREV" --current "$CURRENT"

    # Check if the comparison returned with a non-zero exit code
    # Record the output, maybe with some additional information
    STATUS=$?

    # Final exit code
    # (non-zero if any of the packages failed the checks)
    if [ $STATUS -gt 0 ]
    then
        EXIT_CODE=1
        GITHUB_MESSAGE="${GITHUB_MESSAGE}**\\\`${PACKAGE_PATH}\\\`** has possible breaking changes ([more info](${GITHUB_JOB_LINK}#step:${GITHUB_STEP_NUMBER}:1))<br />"
    fi

done <<< "$PACKAGES"

# "Export" the message to an environment variable that can be used across Github Actions steps
echo "is_breaking=$EXIT_CODE" >> "$GITHUB_OUTPUT"
echo "message=$GITHUB_MESSAGE" >> "$GITHUB_OUTPUT"

# We will exit the workflow accordingly at another step
exit 0
