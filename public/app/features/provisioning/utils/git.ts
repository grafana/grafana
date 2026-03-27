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

export function buildCleanBaseUrl(url: string) {
  return stripSlashes(url.trim()).replace(/\.git\/?$/i, '');
}

/**
 * Formats a repository URL for display by extracting the path portion.
 * e.g., "https://github.com/owner/repo/tree/main/path" -> "owner/repo/tree/main/path"
 */
export function formatRepoUrl(url?: string): string {
  if (!url) {
    return '';
  }
  return url.split('/').slice(3).join('/');
}

// Remove leading and trailing slashes from a string.
const stripSlashes = (s: string) => s.replace(/^\/+|\/+$/g, '');

// Split a path into segments and URL-encode each segment.
// Ensures the final URL remains valid for all providers (GitHub, GitLab, etc.).
const splitAndEncode = (s: string) => stripSlashes(s).split('/').map(encodeURIComponent);

type BuildRepoUrlParams = {
  baseUrl?: string;
  branch?: string | null;
  providerSegments: string[];
  path?: string | null;
};

const buildRepoUrl = ({ baseUrl, branch, providerSegments, path }: BuildRepoUrlParams) => {
  if (!baseUrl) {
    return undefined;
  }

  // Normalize base URL: trim whitespace + remove trailing slashes + remove .git suffix if present
  const cleanBase = buildCleanBaseUrl(baseUrl);

  const cleanBranch = branch?.trim() || undefined;

  // Start composing URL parts:
  // base URL + provider-specific segments (e.g., "tree", "blob", etc.)
  const parts = [cleanBase, ...providerSegments];

  // Append the branch name if present.
  if (cleanBranch) {
    parts.push(cleanBranch);
  }

  // Append encoded path segments if provided.
  // This ensures nested files like "src/utils/index.ts" produce safe URLs.
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
      // Generic git repositories don't have a standard URL pattern
      // Just return the base URL without branch/path segments
      return spec.git?.url ? buildCleanBaseUrl(spec.git.url) : undefined;
    default:
      return undefined;
  }
};

export function getHasTokenInstructions(type: RepoType): type is InstructionAvailability {
  return type === 'github' || type === 'gitlab' || type === 'bitbucket';
}

type GetRepoFileUrlParams = {
  repoType: RepoType;
  url: string | undefined;
  branch?: string | undefined;
  filePath: string | undefined;
  pathPrefix?: string | null;
};

/**
 * Build a URL to a specific source file in a repository.
 * Only works for git providers (GitHub, GitLab, Bitbucket).
 */
export function getRepoFileUrl({
  repoType,
  url,
  branch,
  filePath,
  pathPrefix,
}: GetRepoFileUrlParams): string | undefined {
  if (!url || !filePath) {
    return undefined;
  }

  const effectiveBranch = branch || 'main';
  const fullPath = pathPrefix ? `${pathPrefix.replace(/\/+$/, '')}/${filePath}` : filePath;

  switch (repoType) {
    case 'github':
      return buildRepoUrl({
        baseUrl: url,
        branch: effectiveBranch,
        providerSegments: ['blob'],
        path: fullPath,
      });
    case 'gitlab':
      return buildRepoUrl({
        baseUrl: url,
        branch: effectiveBranch,
        providerSegments: ['-', 'blob'],
        path: fullPath,
      });
    case 'bitbucket':
      return buildRepoUrl({
        baseUrl: url,
        branch: effectiveBranch,
        providerSegments: ['src'],
        path: fullPath,
      });
    default:
      return undefined;
  }
}

export function getRepoCommitUrl(spec?: RepositorySpec, commit?: string) {
  if (!spec || !spec.type || !commit) {
    return { hasUrl: false, url: undefined };
  }

  const gitType = spec.type;

  // local repositories don't have a URL
  if (gitType === 'local') {
    return { hasUrl: false, url: undefined };
  }

  let url: string | undefined = undefined;
  let providerSegments: string[] = [];

  switch (gitType) {
    case 'github':
      if (spec.github?.url) {
        providerSegments = ['commit'];
        url = buildRepoUrl({
          baseUrl: spec.github.url,
          branch: undefined,
          providerSegments,
          path: commit,
        });
      }
      break;
    case 'gitlab':
      if (spec.gitlab?.url) {
        providerSegments = ['-', 'commit'];
        url = buildRepoUrl({
          baseUrl: spec.gitlab.url,
          branch: undefined,
          providerSegments,
          path: commit,
        });
      }
      break;
    case 'bitbucket':
      if (spec.bitbucket?.url) {
        providerSegments = ['commits'];
        url = buildRepoUrl({
          baseUrl: spec.bitbucket.url,
          branch: undefined,
          providerSegments,
          path: commit,
        });
      }
      break;
  }

  return { hasUrl: !!url, url };
}
