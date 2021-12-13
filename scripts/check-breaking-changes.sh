#!/usr/bin/env bash

PACKAGES=$(lerna list -p -l)
EXIT_CODE=0
GITHUB_MESSAGE=""

# Loop through packages
while IFS= read -r line; do

    # Read package info
    IFS=':' read -ra ADDR <<< "$line"
    PACKAGE_PATH="${ADDR[0]}"
    PACKAGE_NAME="${ADDR[1]}"
    PACKAGE_VERSION="${ADDR[2]}"

    # Calculate current and previous package paths / names
    PREV="$PACKAGE_NAME@canary"
    CURRENT="$PACKAGE_PATH/dist/"


    # Run the comparison and record the exit code
    echo ""
    echo ""
    echo "${PACKAGE_NAME}"
    echo "================================================="
    node ./tools/levitate.js compare --prev $PREV --current $CURRENT

    # Check if the comparison returned with a non-zero exit code
    # Record the output, maybe with some additional information
    STATUS=$?

    # Final exit code
    # (non-zero if any of the packages failed the checks) 
    if [ $STATUS -gt 0 ]
    then
        EXIT_CODE=1
        GITHUB_MESSAGE="${GITHUB_MESSAGE}**\`${PACKAGE_NAME}\`** has possible breaking changes ([more info](${GITHUB_JOB_LINK}#step:7:1))<br />"    
    fi    

done <<< "$PACKAGES"

# "Export" the message to an environment variable that can be used across Github Actions steps
echo "BREAKING_CHANGES_IS_BREAKING=$EXIT_CODE" >> $GITHUB_ENV
echo "BREAKING_CHANGES_MESSAGE=$GITHUB_MESSAGE" >> $GITHUB_ENV

# We will exit the workflow accordingly at another step
exit 0