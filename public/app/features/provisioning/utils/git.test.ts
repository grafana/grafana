import { type RepositorySpec } from 'app/api/clients/provisioning/v0alpha1';

import { getRepoEditFileUrl, getRepoFileUrl, getRepoHrefForProvider, getRepoNewFileUrl } from './git';

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

    it('builds generic git href without tree segment', () => {
      expect(
        getRepoHrefForProvider(
          spec({
            type: 'git',
            git: { url: 'https://git.example.com/owner/repo.git', branch: 'main' },
          })
        )
      ).toBe('https://git.example.com/owner/repo');
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

describe('getRepoFileUrl', () => {
  it('joins pathPrefix and filePath with a slash', () => {
    expect(
      getRepoFileUrl({
        repoType: 'github',
        url: 'https://github.com/owner/repo',
        branch: 'main',
        filePath: 'dashboards/my-dashboard.json',
        pathPrefix: 'grafana',
      })
    ).toBe('https://github.com/owner/repo/blob/main/grafana/dashboards/my-dashboard.json');
  });

  it('handles pathPrefix with trailing slash', () => {
    expect(
      getRepoFileUrl({
        repoType: 'github',
        url: 'https://github.com/owner/repo',
        branch: 'main',
        filePath: 'dashboards/my-dashboard.json',
        pathPrefix: 'grafana/',
      })
    ).toBe('https://github.com/owner/repo/blob/main/grafana/dashboards/my-dashboard.json');
  });

  it('uses filePath as-is when pathPrefix is not set', () => {
    expect(
      getRepoFileUrl({
        repoType: 'github',
        url: 'https://github.com/owner/repo',
        branch: 'main',
        filePath: 'dashboards/my-dashboard.json',
      })
    ).toBe('https://github.com/owner/repo/blob/main/dashboards/my-dashboard.json');
  });

  it('returns undefined when url is missing', () => {
    expect(
      getRepoFileUrl({
        repoType: 'github',
        url: undefined,
        filePath: 'dashboards/my-dashboard.json',
      })
    ).toBeUndefined();
  });

  it('returns undefined when filePath is missing', () => {
    expect(
      getRepoFileUrl({
        repoType: 'github',
        url: 'https://github.com/owner/repo',
        filePath: undefined,
      })
    ).toBeUndefined();
  });
});

describe('getRepoEditFileUrl', () => {
  it('builds a GitHub edit URL', () => {
    expect(
      getRepoEditFileUrl({
        repoType: 'github',
        url: 'https://github.com/owner/repo',
        branch: 'main',
        filePath: 'README.md',
      })
    ).toBe('https://github.com/owner/repo/edit/main/README.md');
  });

  it('builds a GitLab edit URL', () => {
    expect(
      getRepoEditFileUrl({
        repoType: 'gitlab',
        url: 'https://gitlab.com/group/repo',
        branch: 'main',
        filePath: 'docs/README.md',
      })
    ).toBe('https://gitlab.com/group/repo/-/edit/main/docs/README.md');
  });

  it('falls back to the source view for Bitbucket', () => {
    expect(
      getRepoEditFileUrl({
        repoType: 'bitbucket',
        url: 'https://bitbucket.org/workspace/repo',
        branch: 'develop',
        filePath: 'README.md',
      })
    ).toBe('https://bitbucket.org/workspace/repo/src/develop/README.md');
  });

  it('joins the repository pathPrefix with the filePath', () => {
    expect(
      getRepoEditFileUrl({
        repoType: 'github',
        url: 'https://github.com/owner/repo',
        branch: 'main',
        filePath: 'README.md',
        pathPrefix: 'dashboards/team-a',
      })
    ).toBe('https://github.com/owner/repo/edit/main/dashboards/team-a/README.md');
  });

  it('defaults to main when branch is missing', () => {
    expect(
      getRepoEditFileUrl({
        repoType: 'github',
        url: 'https://github.com/owner/repo',
        branch: undefined,
        filePath: 'README.md',
      })
    ).toBe('https://github.com/owner/repo/edit/main/README.md');
  });

  it('returns undefined for repository types without a known edit URL', () => {
    expect(
      getRepoEditFileUrl({
        repoType: 'git',
        url: 'https://example.com/some/repo.git',
        filePath: 'README.md',
      })
    ).toBeUndefined();
    expect(
      getRepoEditFileUrl({
        repoType: 'local',
        url: '/data/repo',
        filePath: 'README.md',
      })
    ).toBeUndefined();
  });

  it('returns undefined when url or filePath is missing', () => {
    expect(
      getRepoEditFileUrl({
        repoType: 'github',
        url: undefined,
        filePath: 'README.md',
      })
    ).toBeUndefined();
    expect(
      getRepoEditFileUrl({
        repoType: 'github',
        url: 'https://github.com/owner/repo',
        filePath: undefined,
      })
    ).toBeUndefined();
  });
});

describe('getRepoNewFileUrl', () => {
  it('builds a GitHub new-file URL with filename and prefilled template', () => {
    const url = getRepoNewFileUrl({
      repoType: 'github',
      url: 'https://github.com/owner/repo',
      branch: 'main',
      filePath: 'README.md',
      template: '# Hello',
    });

    expect(url).toBeDefined();
    const parsed = new URL(url!);
    expect(parsed.origin + parsed.pathname).toBe('https://github.com/owner/repo/new/main');
    expect(parsed.searchParams.get('filename')).toBe('README.md');
    expect(parsed.searchParams.get('value')).toBe('# Hello');
  });

  it('joins pathPrefix with filename in the GitHub new-file URL', () => {
    const url = getRepoNewFileUrl({
      repoType: 'github',
      url: 'https://github.com/owner/repo',
      branch: 'main',
      filePath: 'README.md',
      pathPrefix: 'dashboards/team-a',
    });

    expect(new URL(url!).searchParams.get('filename')).toBe('dashboards/team-a/README.md');
  });

  it('builds a GitLab new-file URL with file_name and content', () => {
    const url = getRepoNewFileUrl({
      repoType: 'gitlab',
      url: 'https://gitlab.com/group/repo',
      branch: 'main',
      filePath: 'docs/README.md',
      template: '# Hello',
    });

    const parsed = new URL(url!);
    expect(parsed.origin + parsed.pathname).toBe('https://gitlab.com/group/repo/-/new/main');
    expect(parsed.searchParams.get('file_name')).toBe('docs/README.md');
    expect(parsed.searchParams.get('content')).toBe('# Hello');
  });

  it('falls back to the parent directory source view for Bitbucket', () => {
    const url = getRepoNewFileUrl({
      repoType: 'bitbucket',
      url: 'https://bitbucket.org/workspace/repo',
      branch: 'develop',
      filePath: 'docs/README.md',
    });

    expect(url).toBe('https://bitbucket.org/workspace/repo/src/develop/docs');
  });

  it('returns undefined for repository types without a known new-file URL', () => {
    expect(
      getRepoNewFileUrl({
        repoType: 'git',
        url: 'https://example.com/some/repo.git',
        filePath: 'README.md',
      })
    ).toBeUndefined();
    expect(
      getRepoNewFileUrl({
        repoType: 'local',
        url: '/data/repo',
        filePath: 'README.md',
      })
    ).toBeUndefined();
  });

  it('returns undefined when url or filePath is missing', () => {
    expect(
      getRepoNewFileUrl({
        repoType: 'github',
        url: undefined,
        filePath: 'README.md',
      })
    ).toBeUndefined();
    expect(
      getRepoNewFileUrl({
        repoType: 'github',
        url: 'https://github.com/owner/repo',
        filePath: undefined,
      })
    ).toBeUndefined();
  });
});
