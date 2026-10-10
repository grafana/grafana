import { asNamedRoutingTree, asSimplifiedRouting, toNamedRoutingTree, toSimplifiedRouting } from './routingValue';

describe('asSimplifiedRouting', () => {
  it('returns the value when it has a receiver', () => {
    const value = { type: 'SimplifiedRouting' as const, receiver: 'slack-oncall' };
    expect(asSimplifiedRouting(value)).toBe(value);
  });

  it('returns null for a named-routing-tree value', () => {
    expect(asSimplifiedRouting({ type: 'NamedRoutingTree' as const, routingTree: 'deployment-tools' })).toBeNull();
  });

  it('returns null for null', () => {
    expect(asSimplifiedRouting(null)).toBeNull();
  });
});

describe('asNamedRoutingTree', () => {
  it('returns the value when it has a routingTree', () => {
    const value = { type: 'NamedRoutingTree' as const, routingTree: 'deployment-tools' };
    expect(asNamedRoutingTree(value)).toBe(value);
  });

  it('returns null for a simplified-routing value', () => {
    expect(asNamedRoutingTree({ type: 'SimplifiedRouting' as const, receiver: 'slack-oncall' })).toBeNull();
  });

  it('returns null for null', () => {
    expect(asNamedRoutingTree(null)).toBeNull();
  });
});

describe('toSimplifiedRouting', () => {
  it('builds a value from just a receiver', () => {
    expect(toSimplifiedRouting('slack-oncall')).toEqual({ type: 'SimplifiedRouting', receiver: 'slack-oncall' });
  });

  it('carries the optional timings and intervals along', () => {
    expect(toSimplifiedRouting('slack-oncall', { groupWait: '1m', muteTimeIntervals: ['weekends'] })).toEqual({
      type: 'SimplifiedRouting',
      receiver: 'slack-oncall',
      groupWait: '1m',
      muteTimeIntervals: ['weekends'],
    });
  });

  it('drops blank timings so they are not sent as empty durations', () => {
    const value = toSimplifiedRouting('slack-oncall', { groupWait: '', groupInterval: '5m', repeatInterval: '' });

    expect(JSON.parse(JSON.stringify(value))).toEqual({
      type: 'SimplifiedRouting',
      receiver: 'slack-oncall',
      groupInterval: '5m',
    });
  });

  it('round-trips through asSimplifiedRouting', () => {
    const value = toSimplifiedRouting('slack-oncall');
    expect(asSimplifiedRouting(value)).toBe(value);
  });
});

describe('toNamedRoutingTree', () => {
  it('builds a value from a tree name', () => {
    expect(toNamedRoutingTree('deployment-tools')).toEqual({
      type: 'NamedRoutingTree',
      routingTree: 'deployment-tools',
    });
  });

  it('round-trips through asNamedRoutingTree', () => {
    const value = toNamedRoutingTree('deployment-tools');
    expect(asNamedRoutingTree(value)).toBe(value);
  });
});
