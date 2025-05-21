import { RepositorySpec } from 'app/api/clients/provisioning';

/**
 * Validates a Git branch name according to the following rules:
 * 1. The branch name cannot start with `/`, end with `/`, `.`, or whitespace.
 * 2. The branch name cannot contain consecutive slashes (`//`).
 * 3. The branch name cannot contain consecutive dots (`..`).
 * 4. The branch name cannot contain `@{`.
 * 5. The branch name cannot include the following characters: `~`, `^`, `:`, `?`, `*`, `[`, `\`, or `]`.
 * 6. The branch name must have at least one character and must not be empty.
 */
export function validateBranchName(branchName?: string) {
  const branchNameRegex = /^(?!\/|.*\/\/|.*\.\.|.*@{)(?!.*[~^:?*[\]\\]).+(?<!\/|\.|\s)$/;

  return branchName && branchNameRegex.test(branchName!);
}

export const getRepoHref = (github?: RepositorySpec['github']) => {
  if (!github?.url) {
    return undefined;
  }
  if (!github.branch) {
    return github.url;
  }
  return `${github.url}/tree/${github.branch}`;
};
