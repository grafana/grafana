import { useCallback, useEffect, useMemo, useState } from 'react';

import { getBackendSrv, isFetchError } from '@grafana/runtime';

import { RepoType } from '../Wizard/types';

interface BranchInfo {
  name: string;
  isDefault?: boolean;
}

interface UseBranchFetchingProps {
  repositoryType: RepoType;
  repositoryUrl: string;
  repositoryToken: string;
}

interface UseBranchFetchingResult {
  branches: BranchInfo[];
  loading: boolean;
  error: string | null;
  canFetchBranches: boolean;
}

interface RepositoryInfo {
  owner: string;
  repo: string;
}

const GITHUB_URL_REGEX = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/?$/;
const GITLAB_URL_REGEX = /^https:\/\/gitlab\.com\/([^\/]+)\/([^\/]+)\/?$/;
const BITBUCKET_URL_REGEX = /^https:\/\/bitbucket\.org\/([^\/]+)\/([^\/]+)\/?$/;

function parseRepositoryUrl(url: string, type: RepoType): RepositoryInfo | null {
  let match: RegExpMatchArray | null = null;

  switch (type) {
    case 'github':
      match = url.match(GITHUB_URL_REGEX);
      break;
    case 'gitlab':
      match = url.match(GITLAB_URL_REGEX);
      break;
    case 'bitbucket':
      match = url.match(BITBUCKET_URL_REGEX);
      break;
    default:
      return null;
  }

  if (match && match[1] && match[2]) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ''),
    };
  }

  return null;
}

function canFetchBranchesForProvider(type: RepoType): boolean {
  return ['github', 'gitlab', 'bitbucket'].includes(type);
}

export function useBranchFetching({
  repositoryType,
  repositoryUrl,
  repositoryToken,
}: UseBranchFetchingProps): UseBranchFetchingResult {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canFetchBranches = useMemo(() => {
    return canFetchBranchesForProvider(repositoryType);
  }, [repositoryType]);

  const hasRequiredData = useMemo(() => {
    if (!canFetchBranches) {
      return false;
    }

    const hasUrl = repositoryUrl && repositoryUrl.trim().length > 0;
    const hasToken = repositoryToken && repositoryToken.trim().length > 0;
    const repoInfo = hasUrl ? parseRepositoryUrl(repositoryUrl.trim(), repositoryType) : null;

    return hasUrl && hasToken && repoInfo !== null;
  }, [canFetchBranches, repositoryUrl, repositoryToken, repositoryType]);

  const fetchBranches = useCallback(async () => {
    if (!hasRequiredData) {
      return;
    }

    const trimmedUrl = repositoryUrl.trim();
    const trimmedToken = repositoryToken.trim();
    const repoInfo = parseRepositoryUrl(trimmedUrl, repositoryType);

    if (!repoInfo) {
      setError('Invalid repository URL format');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let apiUrl = '';
      const headers: Record<string, string> = {};

      switch (repositoryType) {
        case 'github':
          apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/branches`;
          headers['Authorization'] = `Bearer ${trimmedToken}`;
          headers['Accept'] = 'application/vnd.github+json';
          break;
        case 'gitlab':
          const encodedPath = encodeURIComponent(`${repoInfo.owner}/${repoInfo.repo}`);
          apiUrl = `https://gitlab.com/api/v4/projects/${encodedPath}/repository/branches`;
          headers['Private-Token'] = trimmedToken;
          break;
        case 'bitbucket':
          apiUrl = `https://api.bitbucket.org/2.0/repositories/${repoInfo.owner}/${repoInfo.repo}/refs/branches`;
          headers['Authorization'] = `Bearer ${trimmedToken}`;
          break;
        default:
          throw new Error(`Unsupported repository type: ${repositoryType}`);
      }

      const backendSrv = getBackendSrv();
      const data = await backendSrv.get(
        apiUrl,
        undefined, // no query params
        undefined, // no requestId
        {
          headers,
          showErrorAlert: false, // Handle errors manually
          hideFromInspector: true, // Hide external API calls from inspector
        }
      );
      let branchData: BranchInfo[] = [];

      if (repositoryType === 'github') {
        if (Array.isArray(data)) {
          branchData = data.map((branch: { name: string }) => ({
            name: branch.name,
            isDefault: branch.name === 'main' || branch.name === 'master',
          }));
        }
      } else if (repositoryType === 'gitlab') {
        if (Array.isArray(data)) {
          branchData = data.map((branch: { name: string; default?: boolean }) => ({
            name: branch.name,
            isDefault: branch.default || branch.name === 'main' || branch.name === 'master',
          }));
        }
      } else if (repositoryType === 'bitbucket') {
        if (data && Array.isArray(data.values)) {
          branchData = data.values.map((branch: { name: string }) => ({
            name: branch.name,
            isDefault: branch.name === 'main' || branch.name === 'master',
          }));
        }
      }

      setBranches(branchData);
    } catch (err: unknown) {
      console.error('Failed to fetch branches:', err);
      let errorMessage = 'Failed to fetch branches';

      if (isFetchError(err)) {
        if (err.status === 401) {
          errorMessage = 'Authentication failed. Please check your access token.';
        } else if (err.status === 404) {
          errorMessage = 'Repository not found. Please check the repository URL.';
        } else if (err.status === 403) {
          errorMessage = 'Access denied. Please check your token permissions.';
        } else if (err.data?.message) {
          errorMessage = err.data.message;
        }
      }

      setError(errorMessage);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, [hasRequiredData, repositoryUrl, repositoryToken, repositoryType]);

  useEffect(() => {
    if (hasRequiredData) {
      setError(null);
      const timeoutId = setTimeout(fetchBranches, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setBranches([]);
      setError(null);
      setLoading(false);
      return undefined;
    }
  }, [hasRequiredData, fetchBranches, repositoryType, repositoryUrl, repositoryToken]);

  return {
    branches,
    loading,
    error,
    canFetchBranches,
  };
}
