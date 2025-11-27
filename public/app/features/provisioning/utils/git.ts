import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { DashboardLink } from '@grafana/schema';
import { provisioningAPIv0alpha1, RepositorySpec, RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, AnnoKeySourcePath, ManagerKind } from 'app/features/apiserver/types';
import { dispatch } from 'app/store/store';

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

  // Normalize base URL: trim whitespace + remove trailing slashes.
  const cleanBase = stripSlashes(baseUrl.trim());
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

export function getRepoFileUrl(spec?: RepositorySpec, filePath?: string) {
  if (!spec || !spec.type || !filePath) {
    return undefined;
  }

  switch (spec.type) {
    case 'github': {
      const { url, branch, path } = spec.github ?? {};
      if (!url) {
        return undefined;
      }
      const fullPath = path ? `${path}${filePath}` : filePath;
      return buildRepoUrl({
        baseUrl: url,
        branch: branch || 'main',
        providerSegments: ['blob'],
        path: fullPath,
      });
    }
    case 'gitlab': {
      const { url, branch, path } = spec.gitlab ?? {};
      if (!url) {
        return undefined;
      }
      const fullPath = path ? `${path}${filePath}` : filePath;
      return buildRepoUrl({
        baseUrl: url,
        branch: branch || 'main',
        providerSegments: ['-', 'blob'],
        path: fullPath,
      });
    }
    case 'bitbucket': {
      const { url, branch, path } = spec.bitbucket ?? {};
      if (!url) {
        return undefined;
      }
      const fullPath = path ? `${path}${filePath}` : filePath;
      return buildRepoUrl({
        baseUrl: url,
        branch: branch || 'main',
        providerSegments: ['src'],
        path: fullPath,
      });
    }
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

/**
 * Build a URL to a specific source file in a repository.
 * Only works for git providers (GitHub, GitLab, Bitbucket).
 */
export function getSourceFileUrl(
  repoType: RepositoryView['type'],
  url: string | undefined,
  branch: string | undefined,
  sourcePath: string | undefined
): string | undefined {
  if (!url || !sourcePath) {
    return undefined;
  }

  switch (repoType) {
    case 'github':
      return branch ? `${url}/blob/${branch}/${sourcePath}` : `${url}/blob/main/${sourcePath}`;
    case 'gitlab':
      return branch ? `${url}/-/blob/${branch}/${sourcePath}` : `${url}/-/blob/main/${sourcePath}`;
    case 'bitbucket':
      return branch ? `${url}/src/${branch}/${sourcePath}` : `${url}/src/main/${sourcePath}`;
    default:
      return undefined;
  }
}

/**
 * Build a source link for a repo-managed dashboard.
 * Returns undefined if the dashboard is not repo-managed or if the repository is not a git provider.
 */
export async function buildSourceLink(
  annotations: Record<string, string | undefined> | undefined
): Promise<DashboardLink | undefined> {
  if (!annotations || !config.featureToggles.provisioning) {
    return undefined;
  }

  const managerKind = annotations[AnnoKeyManagerKind];
  if (managerKind !== ManagerKind.Repo) {
    return undefined;
  }

  const managerIdentity = annotations[AnnoKeyManagerIdentity];
  const sourcePath = annotations[AnnoKeySourcePath];

  if (!managerIdentity || !sourcePath) {
    return undefined;
  }

  try {
    const settingsResult = await dispatch(provisioningAPIv0alpha1.endpoints.getFrontendSettings.initiate());
    if (!settingsResult.data) {
      return undefined;
    }

    const repository = settingsResult.data.items.find((repo) => repo.name === managerIdentity);
    if (!repository || (repository.type !== 'github' && repository.type !== 'gitlab' && repository.type !== 'bitbucket')) {
      return undefined;
    }

    const sourceUrl = getSourceFileUrl(repository.type, repository.url, repository.branch, sourcePath);
    if (!sourceUrl) {
      return undefined;
    }

    const providerName = repository.type.charAt(0).toUpperCase() + repository.type.slice(1);
    return {
      title: t('dashboard.source-link.title', 'Source ({{provider}})', { provider: providerName }),
      type: 'link',
      url: sourceUrl,
      icon: 'external-link-alt',
      tooltip: t('dashboard.source-link.tooltip', 'View source file in repository'),
      targetBlank: true,
      tags: [],
      asDropdown: false,
      includeVars: false,
      keepTime: false,
    };
  } catch (e) {
    console.warn('Failed to fetch repository info for source link:', e);
    return undefined;
  }
}
