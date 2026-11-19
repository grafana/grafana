import { splitFrontmatter } from './markdownFrontmatter';

describe('splitFrontmatter', () => {
  it('splits a leading YAML block into a mapping and returns the rest as the body', () => {
    const markdown = [
      '---',
      'title: Team A',
      'tags:',
      '  - as-code',
      '  - markdown',
      '---',
      '# Hello',
      '',
      'Body.',
    ].join('\n');

    expect(splitFrontmatter(markdown)).toEqual({
      frontmatter: { title: 'Team A', tags: ['as-code', 'markdown'] },
      body: '# Hello\n\nBody.',
    });
  });

  it('accepts `...` as the closing fence', () => {
    expect(splitFrontmatter('---\ntitle: Team A\n...\n# Hello')).toEqual({
      frontmatter: { title: 'Team A' },
      body: '# Hello',
    });
  });

  it('handles CRLF line endings and keeps them in the body', () => {
    expect(splitFrontmatter('---\r\ntitle: Team A\r\n---\r\n# Hello\r\n')).toEqual({
      frontmatter: { title: 'Team A' },
      body: '# Hello\r\n',
    });
  });

  it('ignores a UTF-8 BOM before the opening fence', () => {
    expect(splitFrontmatter('\uFEFF---\ntitle: Team A\n---\n# Hello')).toEqual({
      frontmatter: { title: 'Team A' },
      body: '# Hello',
    });
  });

  it('handles a document that is only front matter, with no trailing newline', () => {
    expect(splitFrontmatter('---\ntitle: Team A\n---')).toEqual({
      frontmatter: { title: 'Team A' },
      body: '',
    });
  });

  it('keeps the body exactly as written, including a later `---` thematic break', () => {
    const body = '\n\nIntro\n\n---\n\nMore  \n';

    expect(splitFrontmatter(`---\na: 1\n---\n${body}`).body).toBe(body);
  });

  it('keeps scalars as the text the author wrote and an empty value as null', () => {
    expect(splitFrontmatter('---\neditable: false\nweight: 1.10\nzip: 01234\nowner:\n---\n').frontmatter).toEqual({
      editable: 'false',
      weight: '1.10',
      zip: '01234',
      owner: null,
    });
  });

  it('keeps dates as the text the author wrote rather than Date objects', () => {
    expect(splitFrontmatter('---\nupdated: 2024-01-15\n---\n').frontmatter).toEqual({ updated: '2024-01-15' });
  });

  it('keeps nested mappings', () => {
    expect(splitFrontmatter('---\nowner:\n  team: platform\n  slack: "#platform"\n---\n').frontmatter).toEqual({
      owner: { team: 'platform', slack: '#platform' },
    });
  });

  it('takes the last value when a key is repeated instead of rejecting the block', () => {
    expect(splitFrontmatter('---\ntitle: First\ntitle: Second\n---\n# Hello')).toEqual({
      frontmatter: { title: 'Second' },
      body: '# Hello',
    });
  });

  it.each([
    { desc: 'empty', markdown: '---\n---\n# Hello' },
    { desc: 'only comments', markdown: '---\n# TODO: add metadata\n---\n# Hello' },
  ])('strips a block that is $desc and returns an empty mapping', ({ markdown }) => {
    expect(splitFrontmatter(markdown)).toEqual({ frontmatter: {}, body: '# Hello' });
  });

  it.each([
    { desc: 'the fence is not on the first line', markdown: '# Title\n\n---\ntitle: Team A\n---\n' },
    { desc: 'a blank line precedes the fence', markdown: '\n---\ntitle: Team A\n---\n' },
    { desc: 'the opening fence is never closed', markdown: '---\ntitle: Team A\n\n# Hello' },
    { desc: 'the YAML is invalid', markdown: '---\ntitle: [unclosed\n---\n# Hello' },
    { desc: 'the YAML uses an explicit non-string tag', markdown: '---\nweight: !!int 5\n---\n# Hello' },
    { desc: 'the YAML is a list', markdown: '---\n- a\n- b\n---\n# Hello' },
    { desc: 'the YAML is a scalar', markdown: '---\njust text\n---\n# Hello' },
  ])('returns the document unchanged with no front matter when $desc', ({ markdown }) => {
    expect(splitFrontmatter(markdown)).toEqual({ body: markdown });
  });
});
