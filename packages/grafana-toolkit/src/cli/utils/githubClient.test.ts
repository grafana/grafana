import GithubClient from './githubClient';

const fakeClient = jest.fn();

beforeEach(() => {
  delete process.env.GITHUB_USERNAME;
  delete process.env.GITHUB_ACCESS_TOKEN;
});

afterEach(() => {
  delete process.env.GITHUB_USERNAME;
  delete process.env.GITHUB_ACCESS_TOKEN;
});

describe('GithubClient', () => {
  it('should initialise a GithubClient', () => {
    const github = new GithubClient();
    const githubEnterprise = new GithubClient({ enterprise: true });
    expect(github).toBeInstanceOf(GithubClient);
    expect(githubEnterprise).toBeInstanceOf(GithubClient);
  });

  describe('#client', () => {
    it('it should contain a grafana client', () => {
      // @ts-ignore
      const spy = jest.spyOn(GithubClient.prototype, 'createClient').mockImplementation(() => fakeClient);

      const github = new GithubClient();
      const client = github.client;

      expect(spy).toHaveBeenCalledWith({
        baseURL: 'https://api.github.com/repos/grafana/grafana',
        timeout: 10000,
      });
      expect(client).toEqual(fakeClient);
    });

    it('it should contain a grafana enterprise client', () => {
      // @ts-ignore
      const spy = jest.spyOn(GithubClient.prototype, 'createClient').mockImplementation(() => fakeClient);

      const github = new GithubClient({ enterprise: true });
      const client = github.client;

      expect(spy).toHaveBeenCalledWith({
        baseURL: 'https://api.github.com/repos/grafana/grafana-enterprise',
        timeout: 10000,
      });
      expect(client).toEqual(fakeClient);
    });

    describe('when the credentials are required', () => {
      it('should create the client when the credentials are defined', () => {
        const username = 'grafana';
        const token = 'averysecureaccesstoken';

        process.env.GITHUB_USERNAME = username;
        process.env.GITHUB_ACCESS_TOKEN = token;

        // @ts-ignore
        const spy = jest.spyOn(GithubClient.prototype, 'createClient').mockImplementation(() => fakeClient);

        const github = new GithubClient({ required: true });
        const client = github.client;

        expect(spy).toHaveBeenCalledWith({
          baseURL: 'https://api.github.com/repos/grafana/grafana',
          timeout: 10000,
          auth: { username, password: token },
        });

        expect(client).toEqual(fakeClient);
      });

      it('should create the enterprise client when the credentials are defined', () => {
        const username = 'grafana';
        const token = 'averysecureaccesstoken';

        process.env.GITHUB_USERNAME = username;
        process.env.GITHUB_ACCESS_TOKEN = token;

        // @ts-ignore
        const spy = jest.spyOn(GithubClient.prototype, 'createClient').mockImplementation(() => fakeClient);

        const github = new GithubClient({ required: true, enterprise: true });
        const client = github.client;

        expect(spy).toHaveBeenCalledWith({
          baseURL: 'https://api.github.com/repos/grafana/grafana-enterprise',
          timeout: 10000,
          auth: { username, password: token },
        });

        expect(client).toEqual(fakeClient);
      });

      describe('when the credentials are not defined', () => {
        it('should throw an error', () => {
          expect(() => {
            // eslint-disable-next-line
            new GithubClient({ required: true });
          }).toThrow(/operation needs a GITHUB_USERNAME and GITHUB_ACCESS_TOKEN environment variables/);
        });
      });
    });
  });
});
