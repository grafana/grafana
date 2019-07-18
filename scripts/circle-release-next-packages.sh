#!/bin/bash

function parse_git_hash() {
  git rev-parse --short HEAD 2> /dev/null | sed "s/\(.*\)/\1/"
}

function prapare_version_commit () {
  echo $'\nCommiting version changes. This commit will not be checked-in!'
  git config --global user.email "circleci@grafana.com"
  git config --global user.name "CirceCI"
  git commit -am "Version commit"
}

#Get current version from lerna.json
PACKAGE_VERSION=`grep '"version"' lerna.json | cut -d '"' -f 4`
# Get short current commit's has
GIT_SHA=$(parse_git_hash)

echo "Commit: ${GIT_SHA}"
echo "Current lerna.json version: ${PACKAGE_VERSION}"

# check if there were any changes to packages between current and previous commit
count=`git diff HEAD~1..HEAD --name-only -- packages | awk '{c++} END {print c}'`



if [ -z $count ]; then
  echo "No changes in packages, skipping packages publishing"
else
  echo "Changes detected in ${count} packages"
  echo "Releasing packages under ${PACKAGE_VERSION}-${GIT_SHA}"
  npx lerna version ${PACKAGE_VERSION}-${GIT_SHA} --no-git-tag-version --no-push --force-publish -y
  echo $'\nGit status:'
  git status -s

  echo $'\nBuilding packages'
  yarn packages:build

  prapare_version_commit

  echo $'\nPublishing packages'
  yarn packages:publishNext
fi

