#!/usr/bin/env bash
#
# Applies the pending version plans to the given nx release groups: bumps the versions, then
# writes the changelog entries, which also deletes the plan files.
#
# nx release changelog needs the new version, and the top-level "nx release" command cannot be
# used because it rejects the per-subcommand git settings that "nx release version" requires.
# Each group is expected to contain a single package that lives in packages/.
#
# Usage: apply-version-plans.sh <group>[,<group>...]

set -euo pipefail

RELEASE_GROUPS="${1:?Usage: apply-version-plans.sh <group>[,<group>...]}"

pnpm exec nx release version --groups="$RELEASE_GROUPS"

IFS=',' read -r -a groups <<<"$RELEASE_GROUPS"
for group in "${groups[@]}"; do
  project=$(jq -r --arg group "$group" '.release.groups[$group].projects[0] // empty' nx.json)
  if [ -z "$project" ]; then
    echo "::error::Release group $group does not exist or has no projects."
    exit 1
  fi

  # shellcheck disable=SC2016 # $name is a jq variable, not a shell variable
  manifest=$(git ls-files -z -- 'packages/*/package.json' | xargs -0 jq -r --arg name "$project" 'select(.name == $name) | input_filename')
  if [ -z "$manifest" ]; then
    echo "::error::Could not find the package.json of $project under packages/."
    exit 1
  fi

  old_version=$(git show "HEAD:$manifest" | jq -r .version)
  new_version=$(jq -r .version "$manifest")
  if [ "$old_version" = "$new_version" ]; then
    echo "$project has no pending version plan, skipping its changelog."
    continue
  fi

  pnpm exec nx release changelog "$new_version" --groups="$group"
done
