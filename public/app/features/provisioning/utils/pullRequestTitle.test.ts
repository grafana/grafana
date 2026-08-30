import { type BranchTemplateVars } from './branchName';
import { appendPullRequestTitleParam, renderPullRequestTitle } from './pullRequestTitle';

const vars: BranchTemplateVars & { random: string } = {
  action: 'update',
  resourceKind: 'dashboard',
  title: 'My Dashboard',
  userLogin: 'ada',
  random: 'x7k2mq',
};

describe('renderPullRequestTitle', () => {
  it('substitutes each variable as free text (no ref sanitisation)', () => {
    expect(renderPullRequestTitle('{{action}} {{resourceKind}} "{{title}}" by {{userLogin}} ({{random}})', vars)).toBe(
      'update dashboard "My Dashboard" by ada (x7k2mq)'
    );
  });

  it('keeps punctuation and case for the {{action}}: {{title}} pattern', () => {
    expect(renderPullRequestTitle('{{action}}: {{title}}', vars)).toBe('update: My Dashboard');
  });

  it.each([undefined, null, '', '   '])('returns an empty string for a blank template (%p)', (template) => {
    expect(renderPullRequestTitle(template, vars)).toBe('');
  });

  it('collapses newlines and runs of whitespace into single spaces and trims', () => {
    expect(renderPullRequestTitle('  {{action}}\n\n{{title}}  \t plus   end  ', vars)).toBe(
      'update My Dashboard plus end'
    );
  });

  it('leaves unrecognised variables as literal text', () => {
    expect(renderPullRequestTitle('PR for {{nope}}', vars)).toBe('PR for {{nope}}');
  });

  it('caps the rendered title at 255 characters', () => {
    const result = renderPullRequestTitle('{{title}}', { ...vars, title: 'a'.repeat(300) });
    expect(result).toBe('a'.repeat(255));
  });
});

describe('appendPullRequestTitleParam', () => {
  const githubUrl = 'https://github.com/org/repo/compare/main...feature?quick_pull=1&labels=grafana';
  const gitlabUrl =
    'https://gitlab.com/org/repo/-/merge_requests/new?merge_request[source_branch]=feature&merge_request[target_branch]=main';
  const bitbucketUrl = 'https://bitbucket.org/org/repo/pull-requests/new?source=feature&dest=main';

  it('appends an encoded title to a GitHub compare URL', () => {
    expect(appendPullRequestTitleParam(githubUrl, 'github', 'update: My Dashboard')).toBe(
      `${githubUrl}&title=update%3A%20My%20Dashboard`
    );
  });

  it('uses merge_request[title] for GitLab', () => {
    expect(appendPullRequestTitleParam(gitlabUrl, 'gitlab', 'update: My Dashboard')).toBe(
      `${gitlabUrl}&merge_request[title]=update%3A%20My%20Dashboard`
    );
  });

  it.each(['bitbucket', 'githubEnterprise'])('uses the plain title param for %s', (repoType) => {
    expect(appendPullRequestTitleParam(bitbucketUrl, repoType, 'Hi there')).toBe(`${bitbucketUrl}&title=Hi%20there`);
  });

  it('uses ? as the separator when the URL has no query string', () => {
    expect(appendPullRequestTitleParam('https://example.com/new', 'github', 'Title')).toBe(
      'https://example.com/new?title=Title'
    );
  });

  it('percent-encodes spaces, colons and hashes in the title', () => {
    expect(appendPullRequestTitleParam('https://x?a=1', 'github', 'a: b #c')).toBe(
      'https://x?a=1&title=a%3A%20b%20%23c'
    );
  });

  it('returns the URL unchanged when there is no title', () => {
    expect(appendPullRequestTitleParam(githubUrl, 'github', '')).toBe(githubUrl);
    expect(appendPullRequestTitleParam(githubUrl, 'github', undefined)).toBe(githubUrl);
  });

  it('returns undefined when there is no URL', () => {
    expect(appendPullRequestTitleParam(undefined, 'github', 'Title')).toBeUndefined();
  });
});
