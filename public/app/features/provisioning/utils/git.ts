import { RepositorySpec } from '../api';

export function createPRLink(spec?: RepositorySpec, dashboardName?: string, ref?: string) {
  if (!spec || spec.type !== 'github' || !ref) {
    return '';
  }
  return `https://github.com/${spec.github?.owner}/${spec.github?.repository}/compare/${spec.github?.branch}...${ref}?quick_pull=1&labels=grafana&title=Update dashboard ${dashboardName}`;
}

/**
 * Validates a Git branch name according to the following rules:
 * 1. The branch name cannot start with `/`, end with `/`, `.`, or whitespace.
 * 2. The branch name cannot contain consecutive slashes (`//`).
 * 3. The branch name cannot contain consecutive dots (`..`).
 * 4. The branch name cannot contain `@{`.
 * 5. The branch name cannot include the following characters: `~`, `^`, `:`, `?`, `*`, `[`, `\`, or `]`.
 * 6. The branch name must have at least one character and must not be empty.
 */
export function validateBranchName(branchName: string) {
  const branchNameRegex = /^(?!\/|.*\/\/|.*\.\.|.*@{)(?!.*[~^:?*[\]\\]).+(?<!\/|\.|\s)$/;

  return branchNameRegex.test(branchName);
}
