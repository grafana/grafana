import { isHttpError } from '../guards';
import { HttpError, RepositoryInfo } from '../types/repository';

export interface ApiRequest {
  url: string;
  headers: Record<string, string>;
}

const githubUrlRegex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/?$/;
const gitlabUrlRegex = /^https:\/\/gitlab\.com\/([^\/]+)\/([^\/]+)\/?$/;
const bitbucketUrlRegex = /^https:\/\/bitbucket\.org\/([^\/]+)\/([^\/]+)\/?$/;

export function parseRepositoryUrl(url: string, type: string): RepositoryInfo | null {
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

export function getProviderHeaders(repositoryType: string, token: string): Record<string, string> {
  switch (repositoryType) {
    case 'github':
      return { Authorization: `Bearer ${token}` };
    case 'gitlab':
      return { 'Private-Token': token };
    case 'bitbucket':
      return { Authorization: `Bearer ${token}` };
    default:
      throw new Error(`Unsupported repository type: ${repositoryType}`);
  }
}

export async function makeApiRequest(request: ApiRequest) {
  const response = await window.fetch(request.url, {
    method: 'GET',
    headers: request.headers,
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('API Error Response:', errorData);
    const error: HttpError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

// GitHub API limits branches to 100 per page, so we need pagination
export async function fetchAllGitHubBranches(
  owner: string,
  repo: string,
  headers: Record<string, string>
): Promise<Array<{ name: string }>> {
  const allBranches = [];
  let page = 1;
  let hasMorePages = true;

  while (hasMorePages && page <= 10) {
    const url = `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100&page=${page}`;
    const data = await makeApiRequest({ url, headers });

    if (Array.isArray(data) && data.length > 0) {
      allBranches.push(...data);
      hasMorePages = data.length === 100;
      page++;
    } else {
      hasMorePages = false;
    }
  }

  return allBranches;
}

// GitLab API also limits to 100 per page,, so we need pagination
export async function fetchAllGitLabBranches(
  owner: string,
  repo: string,
  headers: Record<string, string>
): Promise<Array<{ name: string }>> {
  const allBranches = [];
  let page = 1;
  let hasMorePages = true;

  while (hasMorePages && page <= 10) {
    const encodedPath = encodeURIComponent(`${owner}/${repo}`);
    const url = `https://gitlab.com/api/v4/projects/${encodedPath}/repository/branches?per_page=100&page=${page}`;
    const data = await makeApiRequest({ url, headers });

    if (Array.isArray(data) && data.length > 0) {
      allBranches.push(...data);
      hasMorePages = data.length === 100;
      page++;
    } else {
      hasMorePages = false;
    }
  }

  return allBranches;
}

export async function fetchAllBitbucketBranches(
  owner: string,
  repo: string,
  headers: Record<string, string>
): Promise<Array<{ name: string }>> {
  const url = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/refs/branches?pagelen=1000`;
  const data = await makeApiRequest({ url, headers });

  if (data && Array.isArray(data.values)) {
    return data.values;
  }

  return [];
}

export async function fetchAllBranches(
  repositoryType: string,
  owner: string,
  repo: string,
  token: string
): Promise<Array<{ name: string }>> {
  const headers = getProviderHeaders(repositoryType, token);

  switch (repositoryType) {
    case 'github':
      return fetchAllGitHubBranches(owner, repo, headers);
    case 'gitlab':
      return fetchAllGitLabBranches(owner, repo, headers);
    case 'bitbucket':
      return fetchAllBitbucketBranches(owner, repo, headers);
    default:
      throw new Error(`Unsupported repository type: ${repositoryType}`);
  }
}

export function getErrorMessage(err: unknown) {
  let errorMessage = 'Request failed';

  if (isHttpError(err)) {
    if (err.status === 401) {
      errorMessage = 'Authentication failed. Please check your access token.';
    } else if (err.status === 404) {
      errorMessage = 'Resource not found. Please check the URL or repository.';
    } else if (err.status === 403) {
      errorMessage = 'Access denied. Please check your token permissions.';
    } else if (err.message) {
      errorMessage = err.message;
    }
  }

  return errorMessage;
}
