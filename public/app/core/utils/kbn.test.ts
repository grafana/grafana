import kbn from './kbn';

describe('Chcek KBN value formats', () => {
  it('with connected style, should ignore nulls', () => {
    expect(kbn.valueFormats['s'](10)).toBe('10 s');
  });
});
