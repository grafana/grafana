#!/usr/bin/env bash

# abort if we get any error
set -e

_current="$(git rev-parse --abbrev-ref HEAD)"
_branch="${_current}-docs"

if [ "${_current}" == "master" ]; then
    echo -e "\e[91myou cannot generate api docs from the master branch\e[0m"
    echo "please checkout the release branch"
    echo "ex 'git checkout v5.1.x'"
    exit 1
fi

# always make sure we have a clean workspace
if ! git diff-index --quiet HEAD --; then
    echo -e "\e[91mgit workspace is dirty and contains changes\e[0"
    echo -e "\e[91mmake sure you have a clean workspace before running this script\e[0m"
    exit 1
fi

# always make sure to pull latest changes from origin
echo "pulling latest changes from ${_current}"
git pull origin "${_current}"

# creating new branch for docs update
echo "creating new branch ${_branch}"
git checkout -b "${_branch}"

# building grafana packages
echo "bulding grafana packages..."
yarn packages:build

# extract packages api documentation json
echo "extracting packages documentation data..."
yarn packages:docs-extract

# generating api documentation markdown
echo "generating markdown from documentation data..."
yarn packages:docs-to-markdown

echo "updated files:"
git status --porcelain | sed s/^...//

echo "press [y] to commit documentation update"
read -n 1 confirm

if [ "${confirm}" == "y" ]; then
    git add --all docs/sources/packages_api
    git commit -m "docs: updated packages api documentation"
    git push origin "${_branch}"
    git checkout "${_current}"
    echo -e "\e[92mPackages docs successfully updated. Please open a PR from ${_branch} to master.\e[0m"
else
    git checkout -- .
    git clean -f docs/sources/packages_api
    git checkout "${_current}"
    echo -e "\e[91mAbort!\e[0m"
fi
