#!/usr/bin/env bash
set -eo pipefail

PACKAGES=(ui toolkit data runtime e2e e2e-selectors)

# shellcheck source=./scripts/helpers/exit-if-fail.sh
source "$(dirname "$0")/helpers/exit-if-fail.sh"

function parse_git_hash() {
  git rev-parse --short HEAD 2> /dev/null | sed "s/\(.*\)/\1/"
}

function prepare_version_commit () {
  echo $'\nCommitting version changes. This commit will not be checked-in!'
  git config --global user.email "circleci@grafana.com"
  git config --global user.name "CirceCI"
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

# Get current version from lerna.json
PACKAGE_VERSION=$(grep '"version"' lerna.json | cut -d '"' -f 4)
# Get  current commit's short hash
GIT_SHA=$(parse_git_hash)

echo "Commit: ${GIT_SHA}"
echo "Current lerna.json version: ${PACKAGE_VERSION}"

# check if there were any changes to packages between current and previous commit
count=$(git diff HEAD~1..HEAD --name-only -- packages | awk '{c++} END {print c}')
count="1"
if [ -z "$count" ]; then
  echo "No changes in packages, skipping packages publishing"
else
  echo "Changes detected in ${count} packages"
  echo "Releasing packages under ${PACKAGE_VERSION}-${GIT_SHA}"
  npx lerna version "${PACKAGE_VERSION}-${GIT_SHA}" --exact --no-git-tag-version --no-push --force-publish -y
  echo $'\nGit status:'
  git status -s

  prepare_version_commit

  echo $'\nBuilding packages'

  for PACKAGE in "${PACKAGES[@]}"
  do
    start=$(date +%s%N)
    yarn workspace @grafana/"${PACKAGE}" run build
    runtime=$((($(date +%s%N) - start)/1000000))
    if [ "${DRONE_BRANCH}" == "master" ]; then
      exit_if_fail ./scripts/ci-metrics-publisher.sh "grafana.ci-buildtimes.${DRONE_STEP_NAME}.$PACKAGE=$runtime"
	  elif [ "${CIRCLE_BRANCH}" == "master" ]; then
      exit_if_fail ./scripts/ci-metrics-publisher.sh "grafana.ci-buildtimes.${CIRCLE_JOB}.$PACKAGE=$runtime"
    fi

    exit_status=$?
    if [ $exit_status -eq 0 ]; then
      unpublish_previous_canary "$PACKAGE"
    else
      echo "Packages build failed, skipping canary release"
      # TODO: notify on slack/email?
      exit
    fi
  done

  echo $'\nPublishing packages'
  yarn packages:publishCanary
fi

