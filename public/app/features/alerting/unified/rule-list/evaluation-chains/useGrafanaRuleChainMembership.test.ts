import { extractChainMembership } from './useGrafanaRuleChainMembership';

describe('extractChainMembership', () => {
  it('returns membership when all three annotations are present and well-formed', () => {
    expect(
      extractChainMembership({
        'grafana.com/chain-id': 'usage-chain',
        'grafana.com/chain-position': '2',
        'grafana.com/chain-total': '4',
      })
    ).toEqual({ id: 'usage-chain', position: 2, total: 4 });
  });

  it('returns undefined when annotations is missing', () => {
    expect(extractChainMembership(undefined)).toBeUndefined();
  });

  it('returns undefined when any required annotation is missing', () => {
    expect(
      extractChainMembership({
        'grafana.com/chain-id': 'usage-chain',
        'grafana.com/chain-position': '2',
      })
    ).toBeUndefined();
    expect(
      extractChainMembership({
        'grafana.com/chain-id': 'usage-chain',
        'grafana.com/chain-total': '4',
      })
    ).toBeUndefined();
    expect(
      extractChainMembership({
        'grafana.com/chain-position': '2',
        'grafana.com/chain-total': '4',
      })
    ).toBeUndefined();
  });

  it('returns undefined when position or total is not a positive integer', () => {
    expect(
      extractChainMembership({
        'grafana.com/chain-id': 'usage-chain',
        'grafana.com/chain-position': '0',
        'grafana.com/chain-total': '4',
      })
    ).toBeUndefined();
    expect(
      extractChainMembership({
        'grafana.com/chain-id': 'usage-chain',
        'grafana.com/chain-position': '2',
        'grafana.com/chain-total': 'not-a-number',
      })
    ).toBeUndefined();
    expect(
      extractChainMembership({
        'grafana.com/chain-id': 'usage-chain',
        'grafana.com/chain-position': '-1',
        'grafana.com/chain-total': '4',
      })
    ).toBeUndefined();
  });
});
