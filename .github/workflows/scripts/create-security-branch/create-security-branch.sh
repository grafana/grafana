#!/usr/bin/env bash

set -euo pipefail

# Construct the security branch name.
# When the source release branch is itself a security branch (e.g.
# release-11.2.3+security-01), appending another +security-NN would produce a
# bogus release-11.2.3+security-01+security-02. Instead, strip the existing
# +security-NN suffix and increment its number, so a security release of a
# security release advances to the next number on the same base version.
if [[ "${INPUT_RELEASE_BRANCH}" =~ ^(.*)\+security-([0-9]+)$ ]]; then
    BASE_BRANCH="${BASH_REMATCH[1]}"
    # Increment, preserving the original zero-padded width (e.g. 01 -> 02).
    NEXT_NUMBER=$((10#${BASH_REMATCH[2]} + 1))
    WIDTH=${#BASH_REMATCH[2]}
    SECURITY_NUMBER=$(printf "%0${WIDTH}d" "${NEXT_NUMBER}")
else
    BASE_BRANCH="${INPUT_RELEASE_BRANCH}"
    SECURITY_NUMBER="${INPUT_SECURITY_BRANCH_NUMBER}"
fi

SECURITY_BRANCH="${BASE_BRANCH}+security-${SECURITY_NUMBER}"

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
