import { isHttpError } from '../guards';
import { HttpError } from '../types/repository';

export interface ApiRequest {
  url: string;
  headers: Record<string, string>;
}

export function createApiRequest(
  repositoryType: string,
  token: string
): {
  repositories: ApiRequest;
  branches: (owner: string, repo: string) => ApiRequest;
} {
  const trimmedToken = token.trim();

  switch (repositoryType) {
    case 'github':
      return {
        repositories: {
          url: 'https://api.github.com/user/repos?sort=updated&per_page=100',
          headers: { Authorization: `Bearer ${trimmedToken}` },
        },
        branches: (owner, repo) => ({
          url: `https://api.github.com/repos/${owner}/${repo}/branches`,
          headers: { Authorization: `Bearer ${trimmedToken}` },
        }),
      };

    case 'gitlab':
      return {
        repositories: {
          url: 'https://gitlab.com/api/v4/projects?membership=true&order_by=last_activity_at&sort=desc&per_page=100',
          headers: { 'Private-Token': trimmedToken },
        },
        branches: (owner, repo) => {
          const encodedPath = encodeURIComponent(`${owner}/${repo}`);
          return {
            url: `https://gitlab.com/api/v4/projects/${encodedPath}/repository/branches`,
            headers: { 'Private-Token': trimmedToken },
          };
        },
      };

    case 'bitbucket':
      return {
        repositories: {
          url: 'https://api.bitbucket.org/2.0/repositories?role=member&sort=-updated_on&pagelen=100',
          headers: { Authorization: `Bearer ${trimmedToken}` },
        },
        branches: (owner, repo) => ({
          url: `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/refs/branches`,
          headers: { Authorization: `Bearer ${trimmedToken}` },
        }),
      };

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
