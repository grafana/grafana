import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const grafanaURL = (owner: string, repo: string) => `https://api.github.com/repos/${owner}/${repo}`;
const enterpriseURL = 'https://api.github.com/repos/grafana/grafana-enterprise';

// Encapsulates the creation of a client for the GitHub API
//
// Two key things:
// 1. You can specify whenever you want the credentials to be required or not when imported.
// 2. If the the credentials are available as part of the environment, even if
// they're not required - the library will use them. This allows us to overcome
// any API rate limiting imposed without authentication.

interface GithubClientProps {
  required?: boolean;
  enterprise?: boolean;
  owner?: string;
  repo?: string;
}

class GithubClient {
  client: AxiosInstance;

  constructor({ required = false, enterprise = false, owner = 'grafana', repo = 'grafana' }: GithubClientProps = {}) {
    const username = process.env.GITHUB_USERNAME;
    const token = process.env.GITHUB_ACCESS_TOKEN;

    const clientConfig: AxiosRequestConfig = {
      baseURL: enterprise ? enterpriseURL : grafanaURL(owner, repo),
      timeout: 10000,
    };

    if (required && !username && !token) {
      throw new Error('operation needs a GITHUB_USERNAME and GITHUB_ACCESS_TOKEN environment variables');
    }

    if (username && token) {
      clientConfig.auth = { username: username, password: token };
    }

    this.client = this.createClient(clientConfig);
  }

  private createClient(clientConfig: AxiosRequestConfig) {
    return axios.create(clientConfig);
  }
}

export default GithubClient;
