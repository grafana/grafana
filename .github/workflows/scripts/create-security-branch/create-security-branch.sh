#!/usr/bin/env bash

set -euo pipefail

# Construct the security branch name
SECURITY_BRANCH="${INPUT_RELEASE_BRANCH}+security-${INPUT_SECURITY_BRANCH_NUMBER}"

# Check if branch already exists
if git show-ref --verify --quiet "refs/heads/${SECURITY_BRANCH}"; then
    echo "::error::Security branch ${SECURITY_BRANCH} already exists"
    exit 1
fi

# Create and push the new branch from the release branch
git checkout "${INPUT_RELEASE_BRANCH}"
git checkout -b "${SECURITY_BRANCH}"
git push origin "${SECURITY_BRANCH}"

# Output the branch name for the workflow
echo "branch=${SECURITY_BRANCH}" >> "${GITHUB_OUTPUT}" 
