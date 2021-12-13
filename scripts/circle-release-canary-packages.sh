#!/usr/bin/env bash
set -eo pipefail

# shellcheck source=./scripts/helpers/exit-if-fail.sh
source "$(dirname "$0")/helpers/exit-if-fail.sh"

function prepare_version_commit () {
  echo $'\nCommitting version changes. This commit will not be pushed!'
  git config --global user.email "drone@grafana.com"
  git config --global user.name "Drone"
  git commit -am "Version commit"
}

# check if there were any changes to packages between current and previous commit
count=$(git diff HEAD~1..HEAD --name-only -- packages | awk '{c++} END {print c}')

if [ -z "$count" ]; then
  echo "No changes in packages, skipping packages publishing"
else
  echo "Changes detected in ${count} packages"
  echo "Starting to release latest canary version"

  echo "//registry.npmjs.org/:_authToken=$${NPM_TOKEN}" >> ~/.npmrc

  # For some reason the --no-git-reset is not working as described so
  # to get lerna to publish the packages we need to do a commit to the
  # repository. We will not push this commit to the origin repository.
  prepare_version_commit

  echo $'\nPublishing packages'
  yarn packages:publishCanary
fi

