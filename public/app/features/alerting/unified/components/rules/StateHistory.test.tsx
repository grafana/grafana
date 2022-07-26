import { matchKey } from './StateHistory';

describe('matchKey', () => {
  it('should match with exact string match', () => {
    const groups = ['{ foo=bar, baz=qux }', '{ abc=def, ghi=jkl }'];
    const filter = 'foo=bar';
    const results = groups.filter((group) => matchKey(group, filter));

    expect(results).toStrictEqual([groups[0]]);
  });

  it('should match with regex match', () => {
    const groups = ['{ foo=bar, baz=qux }', '{ abc=def, ghi=jkl }'];
    const filter = '/abc=.*/';
    const results = groups.filter((group) => matchKey(group, filter));

    expect(results).toStrictEqual([groups[1]]);
  });

  it('should match everything with empty filter', () => {
    const groups = ['{ foo=bar, baz=qux }', '{ abc=def, ghi=jkl }'];
    const filter = '';
    const results = groups.filter((group) => matchKey(group, filter));

    expect(results).toStrictEqual(groups);
  });

  it('should match nothing with invalid regex', () => {
    const groups = ['{ foo=bar, baz=qux }', '{ abc=def, ghi=jkl }'];
    const filter = '[';
    const results = groups.filter((group) => matchKey(group, filter));

    expect(results).toStrictEqual([]);
  });
});
