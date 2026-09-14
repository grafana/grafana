import { isDataSourceManagedIdentifier } from './rule-identifier';

describe('isDataSourceManagedIdentifier', () => {
  it.each([
    ['a Ruler identifier', 'cri$Mimir$ns$group$rule$abc'],
    ['a Prometheus identifier', 'pri$Mimir$ns$group$rule$abc'],
    ['a percent-encoded identifier', encodeURIComponent('cri$Mimir$ns$group$rule$abc')],
    ['an identifier with escaped path separators', 'cri$Mimir$my\x1fns$group$rule$abc'],
    ['an identifier with escaped dollars in the rule name', 'cri$Mimir$ns$group$cost_DOLLAR_per_query$abc'],
  ])('says yes to %s', (_, identifier) => {
    expect(isDataSourceManagedIdentifier(identifier)).toBe(true);
  });

  it.each([
    ['nothing', undefined],
    ['an empty string', ''],
    ['a bare Grafana UID', 'some-rule-uid'],
    ['a Grafana UID that happens to start with a prefix', 'critical-cpu-rule'],
    ['an unknown prefix', 'xri$Mimir$ns$group$rule$abc'],
    ['too few fields', 'cri$Mimir$ns'],
    ['too many fields', 'cri$Mimir$ns$group$rule$abc$extra'],
    ['a prefix with nothing after it', 'cri$'],
  ])('says no to %s', (_, identifier) => {
    expect(isDataSourceManagedIdentifier(identifier)).toBe(false);
  });

  it('falls back to the raw value when the identifier will not decode', () => {
    // A stray '%' makes decodeURIComponent throw, and a rule name is allowed to contain one.
    expect(isDataSourceManagedIdentifier('cri$Mimir$ns$group$100%cpu$abc')).toBe(true);
  });
});
