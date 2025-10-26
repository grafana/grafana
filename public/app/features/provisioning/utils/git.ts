import { RepositorySpec } from 'app/api/clients/provisioning/v0alpha1';

import { InstructionAvailability, RepoType } from '../Wizard/types';

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

export const getRepoHrefForProvider = (spec?: RepositorySpec) => {
  if (!spec || !spec.type) {
    return undefined;
  }

  switch (spec.type) {
    case 'github': {
      const url = spec.github?.url;
      const branch = spec.github?.branch;
      if (!url) {
        return undefined;
      }
      return branch ? `${url}/tree/${branch}` : url;
    }

    case 'gitlab': {
      const url = spec.gitlab?.url;
      const branch = spec.gitlab?.branch;
      if (!url) {
        return undefined;
      }
      return branch ? `${url}/-/tree/${branch}` : url;
    }
    case 'bitbucket': {
      const url = spec.bitbucket?.url;
      const branch = spec.bitbucket?.branch;
      if (!url) {
        return undefined;
      }
      return branch ? `${url}/src/${branch}` : url;
    }
    case 'git': {
      // Return a generic URL for pure git repositories
      return spec.git?.url;
    }
    default:
      return undefined;
  }
};

export function getHasTokenInstructions(type: RepoType): type is InstructionAvailability {
  return type === 'github' || type === 'gitlab' || type === 'bitbucket';
}

export function getRepoCommitUrl(spec?: RepositorySpec, commit?: string) {
  let url: string | undefined = undefined;
  let hasUrl = false;

  if (!spec || !spec.type || !commit) {
    return { hasUrl, url };
  }

  const gitType = spec.type;

  // local repositories don't have a URL
  if (gitType !== 'local' && commit) {
    switch (gitType) {
      case 'github':
        if (spec.github?.url) {
          url = `${spec.github.url}/commit/${commit}`;
          hasUrl = true;
        }
        break;
      case 'gitlab':
        if (spec.gitlab?.url) {
          url = `${spec.gitlab.url}/-/commit/${commit}`;
          hasUrl = true;
        }
        break;
      case 'bitbucket':
        if (spec.bitbucket?.url) {
          url = `${spec.bitbucket.url}/commits/${commit}`;
          hasUrl = true;
        }
        break;
    }
  }

  return { hasUrl, url };
}
