import { useCallback, useEffect, useMemo, useState } from 'react';

import { isSupportedGitProvider } from '../guards';
import { BranchInfo, RepositoryInfo, UseBranchFetchingProps, UseBranchFetchingResult } from '../types/repository';
import { createApiRequest, getErrorMessage, makeApiRequest } from '../utils/httpUtils';

const GITHUB_URL_REGEX = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/?$/;
const GITLAB_URL_REGEX = /^https:\/\/gitlab\.com\/([^\/]+)\/([^\/]+)\/?$/;
const BITBUCKET_URL_REGEX = /^https:\/\/bitbucket\.org\/([^\/]+)\/([^\/]+)\/?$/;

export function parseRepositoryUrl(url: string, type: string): RepositoryInfo | null {
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

export function useBranchFetching({
  repositoryType,
  repositoryUrl,
  repositoryToken,
}: UseBranchFetchingProps): UseBranchFetchingResult {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasRequiredData = useMemo(() => {
    if (!isSupportedGitProvider(repositoryType)) {
      return false;
    }

    const hasUrl = repositoryUrl && repositoryUrl.trim().length > 0;
    const hasToken = repositoryToken && repositoryToken.trim().length > 0;
    const repoInfo = hasUrl ? parseRepositoryUrl(repositoryUrl.trim(), repositoryType) : null;

    return hasUrl && hasToken && repoInfo !== null;
  }, [repositoryUrl, repositoryToken, repositoryType]);

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
      const apiConfig = createApiRequest(repositoryType, trimmedToken);
      const data = await makeApiRequest(apiConfig.branches(repoInfo.owner, repoInfo.repo));
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
      setError(getErrorMessage(err));
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
  };
}
