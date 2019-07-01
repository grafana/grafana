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
    expect(github).toBeInstanceOf(GithubClient);
  });

  describe('#client', () => {
    it('it should contain a client', () => {
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

    describe('when the credentials are required', () => {
      it('should create the client when the credentials are defined', () => {
        const username = 'grafana';
        const token = 'averysecureaccesstoken';

        process.env.GITHUB_USERNAME = username;
        process.env.GITHUB_ACCESS_TOKEN = token;

        // @ts-ignore
        const spy = jest.spyOn(GithubClient.prototype, 'createClient').mockImplementation(() => fakeClient);

        const github = new GithubClient(true);
        const client = github.client;

        expect(spy).toHaveBeenCalledWith({
          baseURL: 'https://api.github.com/repos/grafana/grafana',
          timeout: 10000,
          auth: { username, password: token },
        });

        expect(client).toEqual(fakeClient);
      });

      describe('when the credentials are not defined', () => {
        it('should throw an error', () => {
          expect(() => {
            // tslint:disable-next-line
            new GithubClient(true);
          }).toThrow(/operation needs a GITHUB_USERNAME and GITHUB_ACCESS_TOKEN environment variables/);
        });
      });
    });
  });
});
