import { getGitProviderFields } from './fields';

describe('URL validation patterns', () => {
  function getUrlPattern(provider: 'github' | 'gitlab' | 'bitbucket' | 'git'): RegExp {
    const fields = getGitProviderFields(provider);
    const pattern = fields?.urlConfig.validation?.pattern?.value;
    if (!pattern) {
      throw new Error(`No URL pattern found for provider: ${provider}`);
    }
    return pattern;
  }

  describe('GitHub', () => {
    let pattern: RegExp;
    beforeAll(() => {
      pattern = getUrlPattern('github');
    });

    it.each([
      ['https://github.com/owner/repo', true],
      ['https://github.com/owner/repo/', true],
      ['https://github.example.com/owner/repo', true],
    ])('%s → %s', (url, expected) => {
      expect(pattern.test(url)).toBe(expected);
    });

    it.each([
      ['https://github.com/owner/repo/extra', false],
      ['https://github.com/owner', false],
      ['http://github.com/owner/repo', false],
      ['https://github.com/', false],
      ['https://github.com/owner//repo', false],
    ])('rejects %s', (url, expected) => {
      expect(pattern.test(url)).toBe(expected);
    });
  });

  describe('GitLab', () => {
    let pattern: RegExp;
    beforeAll(() => {
      pattern = getUrlPattern('gitlab');
    });

    it.each([
      // Standard 2-segment path
      ['https://gitlab.com/owner/repo', true],
      ['https://gitlab.com/owner/repo/', true],
      // Subgroup paths (the fix)
      ['https://gitlab.com/group/subgroup/repo', true],
      ['https://gitlab.com/group/subgroup/repo/', true],
      ['https://gitlab.com/group/sub1/sub2/repo', true],
      ['https://gitlab.com/group/sub1/sub2/sub3/repo', true],
      // Self-hosted
      ['https://gitlab.example.com/org/team/project', true],
    ])('%s → %s', (url, expected) => {
      expect(pattern.test(url)).toBe(expected);
    });

    it.each([
      // Must have at least 2 path segments
      ['https://gitlab.com/owner', false],
      // No http
      ['http://gitlab.com/owner/repo', false],
      // Empty segments
      ['https://gitlab.com/owner//repo', false],
      // No path
      ['https://gitlab.com/', false],
      // Bare hostname
      ['https://gitlab.com', false],
    ])('rejects %s', (url, expected) => {
      expect(pattern.test(url)).toBe(expected);
    });
  });

  describe('Bitbucket', () => {
    let pattern: RegExp;
    beforeAll(() => {
      pattern = getUrlPattern('bitbucket');
    });

    it.each([
      ['https://bitbucket.org/workspace/repo', true],
      ['https://bitbucket.org/workspace/repo/', true],
      ['https://bitbucket.example.com/workspace/repo', true],
    ])('%s → %s', (url, expected) => {
      expect(pattern.test(url)).toBe(expected);
    });

    it.each([
      ['https://bitbucket.org/workspace/repo/extra', false],
      ['https://bitbucket.org/workspace', false],
      ['http://bitbucket.org/workspace/repo', false],
      ['https://bitbucket.org/', false],
      ['https://bitbucket.org/workspace//repo', false],
    ])('rejects %s', (url, expected) => {
      expect(pattern.test(url)).toBe(expected);
    });
  });

  describe('Git (generic)', () => {
    let pattern: RegExp;
    beforeAll(() => {
      pattern = getUrlPattern('git');
    });

    it.each([
      ['https://git.example.com/owner/repo.git', true],
      ['http://git.example.com/owner/repo.git', true],
      ['https://git.example.com/owner/repo', true],
      ['https://git.example.com/a/b/c/d', true],
      ['http://anything', true],
    ])('%s → %s', (url, expected) => {
      expect(pattern.test(url)).toBe(expected);
    });

    it.each([
      ['ftp://git.example.com/repo', false],
      ['git@github.com:owner/repo.git', false],
    ])('rejects %s', (url, expected) => {
      expect(pattern.test(url)).toBe(expected);
    });
  });
});
