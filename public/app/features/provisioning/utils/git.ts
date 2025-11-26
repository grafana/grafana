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

const stripSlashes = (s: string) => s.replace(/^\/+|\/+$/g, '');
const splitAndEncode = (s: string) => stripSlashes(s).split('/').map(encodeURIComponent);

const buildRepoUrl = ({
  baseUrl,
  branch,
  providerSegments,
  path,
}: {
  baseUrl?: string;
  branch?: string | null;
  providerSegments: string[];
  path?: string | null;
}) => {
  if (!baseUrl) {
    return undefined;
  }

  const cleanBase = stripSlashes(baseUrl.trim());
  const cleanBranch = branch?.trim() || undefined;

  const parts = [cleanBase, ...providerSegments];

  if (cleanBranch) {
    parts.push(cleanBranch);
  }

  if (path) {
    parts.push(...splitAndEncode(path.trim()));
  }

  return parts.join('/');
};

export const getRepoHrefForProvider = (spec?: RepositorySpec) => {
  if (!spec || !spec.type) {
    return undefined;
  }

  switch (spec.type) {
    case 'github':
      return buildRepoUrl({
        baseUrl: spec.github?.url,
        branch: spec.github?.branch,
        providerSegments: ['tree'],
        path: spec.github?.path,
      });
    case 'gitlab':
      return buildRepoUrl({
        baseUrl: spec.gitlab?.url,
        branch: spec.gitlab?.branch,
        providerSegments: ['-', 'tree'],
        path: spec.gitlab?.path,
      });
    case 'bitbucket':
      return buildRepoUrl({
        baseUrl: spec.bitbucket?.url,
        branch: spec.bitbucket?.branch,
        providerSegments: ['src'],
        path: spec.bitbucket?.path,
      });
    case 'git':
      return buildRepoUrl({
        baseUrl: spec.git?.url,
        branch: spec.git?.branch,
        providerSegments: ['tree'],
        path: spec.git?.path,
      });
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
