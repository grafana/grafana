import { useCallback, useEffect, useMemo, useState } from 'react';

import { isSupportedGitProvider } from '../guards';
import { BranchInfo, RepositoryInfo, UseBranchFetchingProps } from '../types/repository';
import { createApiRequest, getErrorMessage, makeApiRequest } from '../utils/httpUtils';

const githubUrlRegex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/?$/;
const gitlabUrlRegex = /^https:\/\/gitlab\.com\/([^\/]+)\/([^\/]+)\/?$/;
const bitbucketUrlRegex = /^https:\/\/bitbucket\.org\/([^\/]+)\/([^\/]+)\/?$/;

function parseRepositoryUrl(url: string, type: string): RepositoryInfo | null {
  let match: RegExpMatchArray | null = null;

  switch (type) {
    case 'github':
      match = url.match(githubUrlRegex);
      break;
    case 'gitlab':
      match = url.match(gitlabUrlRegex);
      break;
    case 'bitbucket':
      match = url.match(bitbucketUrlRegex);
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
  repositoryUrl = '',
  repositoryToken = '',
}: UseBranchFetchingProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedUrl = repositoryUrl.trim();
  const trimmedToken = repositoryToken.trim();

  const hasRequiredData = useMemo(() => {
    if (!isSupportedGitProvider(repositoryType)) {
      return false;
    }

    const hasUrl = trimmedUrl.length > 0;
    const hasToken = trimmedToken.length > 0;
    const repoInfo = hasUrl ? parseRepositoryUrl(trimmedUrl, repositoryType) : null;

    return hasUrl && hasToken && repoInfo !== null;
  }, [trimmedUrl, trimmedToken, repositoryType]);

  const fetchBranches = useCallback(async () => {
    if (!hasRequiredData) {
      return;
    }

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
          }));
        }
      } else if (repositoryType === 'gitlab') {
        if (Array.isArray(data)) {
          branchData = data.map((branch: { name: string }) => ({
            name: branch.name,
          }));
        }
      } else if (repositoryType === 'bitbucket') {
        if (data && Array.isArray(data.values)) {
          branchData = data.values.map((branch: { name: string }) => ({
            name: branch.name,
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
  }, [hasRequiredData, trimmedUrl, trimmedToken, repositoryType]);

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
  }, [hasRequiredData, fetchBranches]);

  return {
    branches,
    loading,
    error,
  };
}
