import { isHttpError } from '../guards';
import { HttpError } from '../types/repository';

export interface ApiRequest {
  url: string;
  headers: Record<string, string>;
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

export function getBranchesUrl(repositoryType: string, owner: string, repo: string): string {
  switch (repositoryType) {
    case 'github':
      return `https://api.github.com/repos/${owner}/${repo}/branches`;
    case 'gitlab': {
      const encodedPath = encodeURIComponent(`${owner}/${repo}`);
      return `https://gitlab.com/api/v4/projects/${encodedPath}/repository/branches`;
    }
    case 'bitbucket':
      return `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/refs/branches`;
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
