#!/usr/bin/env bash
set -eo pipefail

PACKAGES=(ui toolkit data runtime e2e e2e-selectors)

# shellcheck source=./scripts/helpers/exit-if-fail.sh
source "$(dirname "$0")/helpers/exit-if-fail.sh"

function prepare_version_commit () {
  echo $'\nCommitting version changes. This commit will not be pushed!'
  git config --global user.email "drone@grafana.com"
  git config --global user.name "Drone"
  git commit -am "Version commit"
}

function unpublish_previous_canary () {
  _package=$1
  echo $'\nUnpublishing previous canary packages'
  # dist-tag next to be changed to canary when https://github.com/grafana/grafana/pull/18195 is merged
  CURRENT_CANARY=$(npm view @grafana/"${_package}" dist-tags.canary)
  if [ -z "${CURRENT_CANARY}" ]; then
      echo "@grafana/${_package} - Nothing to unpublish"
  else
    echo "Unpublish @grafana/${_package}@${CURRENT_CANARY}"
    _response=$(npm unpublish @grafana/"${_package}"@"${CURRENT_CANARY}" 2>&1) || (
      echo "$_response" | grep "404" || (
        # We want to deprecate here, rather than fail and return an non-0 exit code
        echo "Unpublish unsuccessful [$?]. Deprecating @grafana/${_package}@${CURRENT_CANARY}"
        _response=$(npm deprecate @grafana/"${_package}"@"${CURRENT_CANARY}" "this package has been deprecated" 2>&1) || (
          echo "$_response" | grep "404" && return 0
        )
      )
    )
  fi
}

# check if there were any changes to packages between current and previous commit
count=$(git diff HEAD~1..HEAD --name-only -- packages | awk '{c++} END {print c}')
count="1"
if [ -z "$count" ]; then
  echo "No changes in packages, skipping packages publishing"
else
  echo "Changes detected in ${count} packages"
  echo "Starting to release latest canary version"

  # For some reason the --no-git-reset is not working as described so
  # to get lerna to publish the packages we need to do a commit to the
  # repository. We will not push this commit to the origin repository.
  prepare_version_commit

  # Frontend packages have already been versioned and built by the
  # build-frontend step in drone. We will only unpublish the previous
  # canary version and publish the current built version as the new
  # latest canary build.
  for PACKAGE in "${PACKAGES[@]}"
  do
    unpublish_previous_canary "$PACKAGE"
  done

  echo $'\nPublishing packages'
  yarn packages:publishCanary
fi

