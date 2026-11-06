#!/usr/bin/env bash
#
# Bumps the versions of the given nx release groups from the conventional commits since their last
# release tag, then writes the changelog entries.
#
# nx release changelog needs the new version, and the top-level "nx release" command cannot be
# used because it rejects the per-subcommand git settings that "nx release version" requires.
# Each group is expected to contain a single package that lives in packages/.
#
# Usage: version-and-changelog.sh <group>[,<group>...]

set -euo pipefail

RELEASE_GROUPS="${1:?Usage: version-and-changelog.sh <group>[,<group>...]}"

IFS=',' read -r -a groups <<<"$RELEASE_GROUPS"

# Sets $project and $manifest for a release group.
resolve_group() {
  project=$(jq -r --arg group "$1" '.release.groups[$group].projects[0] // empty' nx.json)
  if [ -z "$project" ]; then
    echo "::error::Release group $1 does not exist or has no projects."
    exit 1
  fi

  # shellcheck disable=SC2016 # $name is a jq variable, not a shell variable
  manifest=$(git ls-files -z -- 'packages/*/package.json' | xargs -0 jq -r --arg name "$project" 'select(.name == $name) | input_filename')
  if [ -z "$manifest" ]; then
    echo "::error::Could not find the package.json of $project under packages/."
    exit 1
  fi
}

# nx release reads the last release from a git tag, which the publish workflow creates after the
# release pull request is merged. Until that tag exists, nx would version and write the changelog
# from commits that were already released.
for group in "${groups[@]}"; do
  resolve_group "$group"
  tag="${project}@$(git show "HEAD:$manifest" | jq -r .version)"
  if ! git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
    echo "::notice::The tag ${tag} does not exist yet, so the last release of $project is not published. Skipping."
    exit 0
  fi
done

pnpm exec nx release version --groups="$RELEASE_GROUPS"

for group in "${groups[@]}"; do
  resolve_group "$group"

  old_version=$(git show "HEAD:$manifest" | jq -r .version)
  new_version=$(jq -r .version "$manifest")
  if [ "$old_version" = "$new_version" ]; then
    echo "$project has no releasable commits since its last release, skipping its changelog."
    continue
  fi

  pnpm exec nx release changelog "$new_version" --groups="$group"
done
