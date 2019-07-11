#!/usr/bin/env bash

#!/bin/bash

# function exit_if_fail {
#     command=$@
#     echo "Executing '$command'"
#     eval $command
#     rc=$?
#     if [ $rc -ne 0 ]; then
#         echo "'$command' returned $rc."
#         exit $rc
#     fi
# }

# npm install lerna
# count=0
# rc=$?


function parse_git_hash() {
  git rev-parse --short HEAD 2> /dev/null | sed "s/\(.*\)/\1/"
}

#Get current version from lerna.json
PACKAGE_VERSION=`grep '"version"' lerna.json | cut -d '"' -f 4`
# Get short current commit's has
GIT_BRANCH=$(parse_git_hash)

echo "Commit: ${GIT_BRANCH}"
echo "Current lerna.json version: ${PACKAGE_VERSION}"

# count packages that changed
count=`lerna changed --loglevel silent | awk '{c++} END {print c}'`

if [ -z $count ]; then
  echo "No changes in packages, not publishing"
else
  echo "Changes detected in ${count} packages"
  echo "Releasing packages under ${PACKAGE_VERSION}-${GIT_BRANCH}"
  lerna version ${PACKAGE_VERSION}-${GIT_BRANCH} --no-git-tag-version --no-push --force-publish -y
  git status -s
fi

