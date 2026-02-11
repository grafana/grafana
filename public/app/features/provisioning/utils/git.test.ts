import { RepositorySpec } from 'app/api/clients/provisioning/v0alpha1';

import { getRepoHrefForProvider } from './git';

// Partial specs for testing; getRepoHrefForProvider only reads type and provider url/branch/path.
function spec(s: Partial<RepositorySpec>): RepositorySpec {
  return s as RepositorySpec;
}

describe('buildRepoUrl', () => {
  describe('base URL normalization', () => {
    it('strips trailing .git from GitHub URL', () => {
      expect(
        getRepoHrefForProvider(
          spec({
            type: 'github',
            github: { url: 'https://github.com/owner/repo.git', branch: 'main' },
          })
        )
      ).toBe('https://github.com/owner/repo/tree/main');
    });

    it('strips trailing .git/ from base URL', () => {
      expect(
        getRepoHrefForProvider(
          spec({
            type: 'github',
            github: { url: 'https://github.com/owner/repo.git/', branch: 'main' },
          })
        )
      ).toBe('https://github.com/owner/repo/tree/main');
    });

    it('leaves URL unchanged when it does not end with .git', () => {
      expect(
        getRepoHrefForProvider(
          spec({
            type: 'github',
            github: { url: 'https://github.com/owner/repo', branch: 'main' },
          })
        )
      ).toBe('https://github.com/owner/repo/tree/main');
    });

    it('trims whitespace from base URL', () => {
      expect(
        getRepoHrefForProvider(
          spec({
            type: 'github',
            github: { url: '  https://github.com/owner/repo  ', branch: 'main' },
          })
        )
      ).toBe('https://github.com/owner/repo/tree/main');
    });
  });

  describe('branch and path', () => {
    it('builds URL with branch only', () => {
      expect(
        getRepoHrefForProvider(
          spec({
            type: 'github',
            github: { url: 'https://github.com/owner/repo', branch: 'develop' },
          })
        )
      ).toBe('https://github.com/owner/repo/tree/develop');
    });

    it('builds URL with path segments encoded', () => {
      expect(
        getRepoHrefForProvider(
          spec({
            type: 'github',
            github: {
              url: 'https://github.com/owner/repo',
              branch: 'main',
              path: 'src/utils/index.ts',
            },
          })
        )
      ).toBe('https://github.com/owner/repo/tree/main/src/utils/index.ts');
    });

    it('builds URL without branch when branch is missing', () => {
      expect(
        getRepoHrefForProvider(
          spec({
            type: 'github',
            github: { url: 'https://github.com/owner/repo' } as RepositorySpec['github'],
          })
        )
      ).toBe('https://github.com/owner/repo/tree');
    });
  });

  describe('providers', () => {
    it('builds GitHub href with tree segment', () => {
      expect(
        getRepoHrefForProvider(
          spec({
            type: 'github',
            github: { url: 'https://github.com/org/my-repo.git', branch: 'main' },
          })
        )
      ).toBe('https://github.com/org/my-repo/tree/main');
    });

    it('builds GitLab href with -/tree segments', () => {
      expect(
        getRepoHrefForProvider(
          spec({
            type: 'gitlab',
            gitlab: { url: 'https://gitlab.com/group/project.git', branch: 'main' },
          })
        )
      ).toBe('https://gitlab.com/group/project/-/tree/main');
    });

    it('builds Bitbucket href with src segment', () => {
      expect(
        getRepoHrefForProvider(
          spec({
            type: 'bitbucket',
            bitbucket: { url: 'https://bitbucket.org/workspace/repo.git', branch: 'main' },
          })
        )
      ).toBe('https://bitbucket.org/workspace/repo/src/main');
    });

    it('builds generic git href with tree segment', () => {
      expect(
        getRepoHrefForProvider(
          spec({
            type: 'git',
            git: { url: 'https://git.example.com/owner/repo.git', branch: 'main' },
          })
        )
      ).toBe('https://git.example.com/owner/repo/tree/main');
    });
  });

  describe('edge cases', () => {
    it('returns undefined when spec is undefined', () => {
      expect(getRepoHrefForProvider(undefined)).toBeUndefined();
    });

    it('returns undefined when type is missing', () => {
      expect(getRepoHrefForProvider(spec({ type: undefined }))).toBeUndefined();
    });

    it('returns undefined when base URL is missing for provider', () => {
      expect(
        getRepoHrefForProvider(spec({ type: 'github', github: { url: undefined, branch: 'main' } }))
      ).toBeUndefined();
    });

    it('returns undefined for unknown provider type', () => {
      expect(getRepoHrefForProvider({ type: 'unknown' } as unknown as RepositorySpec)).toBeUndefined();
    });
  });
});
