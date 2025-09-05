import { t } from '@grafana/i18n';

import { HttpError, isHttpError } from '../guards';

export interface RepositoryInfo {
  owner: string;
  repo: string;
}

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
      return { Authorization: `Basic ${btoa(token)}` };
    default:
      throw new Error(
        t('provisioning.http-utils.unsupported-repository-type', 'Unsupported repository type: {{repositoryType}}', {
          repositoryType,
        })
      );
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
    const error: HttpError = new Error(
      t('provisioning.http-utils.http-error', 'HTTP {{status}}: {{statusText}}', {
        status: response.status,
        statusText: response.statusText,
      })
    );
    error.status = response.status;
    throw error;
  }

  return response.json();
}

// GitHub, GitLab, and Bitbucket limit results to 100 items per page, so we need to paginate
async function fetchWithPagination(
  buildUrl: (page: number) => string,
  headers: Record<string, string>
): Promise<Array<{ name: string }>> {
  const allBranches = [];
  let page = 1;
  let hasMorePages = true;

  while (hasMorePages && page <= 10) {
    const url = buildUrl(page);
    const data = await makeApiRequest({ url, headers });

    // Handle GitHub/GitLab format (direct array) and Bitbucket format ({ values: [...] })
    const branches = Array.isArray(data) ? data : data?.values;

    if (Array.isArray(branches) && branches.length > 0) {
      allBranches.push(...branches);
      hasMorePages = branches.length === 100;
      page++;
    } else {
      hasMorePages = false;
    }
  }

  return allBranches;
}

export async function fetchAllGitHubBranches(
  owner: string,
  repo: string,
  headers: Record<string, string>
): Promise<Array<{ name: string }>> {
  return fetchWithPagination(
    (page) => `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100&page=${page}`,
    headers
  );
}

export async function fetchAllGitLabBranches(
  owner: string,
  repo: string,
  headers: Record<string, string>
): Promise<Array<{ name: string }>> {
  const encodedPath = encodeURIComponent(`${owner}/${repo}`);
  return fetchWithPagination(
    (page) => `https://gitlab.com/api/v4/projects/${encodedPath}/repository/branches?per_page=100&page=${page}`,
    headers
  );
}

export async function fetchAllBitbucketBranches(
  owner: string,
  repo: string,
  headers: Record<string, string>
): Promise<Array<{ name: string }>> {
  return fetchWithPagination(
    (page) => `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/refs/branches?pagelen=100&page=${page}`,
    headers
  );
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
      throw new Error(
        t('provisioning.http-utils.unsupported-repository-type', 'Unsupported repository type: {{repositoryType}}', {
          repositoryType,
        })
      );
  }
}

export function getErrorMessage(err: unknown) {
  let errorMessage = t('provisioning.http-utils.request-failed', 'Request failed');

  if (isHttpError(err)) {
    if (err.status === 401) {
      errorMessage = t(
        'provisioning.http-utils.authentication-failed',
        'Authentication failed. Please check your access token.'
      );
    } else if (err.status === 404) {
      errorMessage = t(
        'provisioning.http-utils.resource-not-found',
        'Resource not found. Please check the URL or repository.'
      );
    } else if (err.status === 403) {
      errorMessage = t('provisioning.http-utils.access-denied', 'Access denied. Please check your token permissions.');
    } else if (err.message) {
      errorMessage = err.message;
    }
  }

  return errorMessage;
}
