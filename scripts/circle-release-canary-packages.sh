#!/usr/bin/env bash
set -eo pipefail

# shellcheck source=./scripts/helpers/exit-if-fail.sh
source "$(dirname "$0")/helpers/exit-if-fail.sh"

# check if there were any changes to packages between current and previous commit
count=$(git diff HEAD~1..HEAD --name-only -- packages | awk '{c++} END {print c}')

if [ -z "$count" ]; then
  echo "No changes in packages, skipping packages publishing"
else
  echo "Changes detected in ${count} packages"
  echo "Starting to release latest canary version"

  echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> ~/.npmrc

  echo $'\nPacking packages'
  yarn packages:pack

  echo $'\nPublishing packages'
  yarn packages:publishCanary
fi

