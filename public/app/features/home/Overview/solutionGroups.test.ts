import { type DataSourceInstanceListItem } from '@grafana/data';

import { type Solution, type SolutionOffer } from '../solutions/types';

import { resolveOverviewCard } from './solutionGroups';

const datasource: DataSourceInstanceListItem = {
  uid: 'datasource',
  name: 'Datasource',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: true,
};

const offer: SolutionOffer = {
  availability: 'enable',
  description: 'Connect Prometheus-compatible metrics.',
  cta: { label: 'Enable', href: '/plugins/grafana-metricsdrilldown-app/', action: 'enable' },
};

function solution(overrides: Partial<Solution>): Solution {
  return {
    id: 'metrics',
    title: 'Metrics & infrastructure',
    icon: 'chart-line',
    signal: async () => 'inactive',
    datasource: async () => null,
    needsAttention: async () => false,
    stats: async () => null,
    refinedStats: async () => null,
    sparkline: async () => null,
    cta: async () => null,
    alert: async () => null,
    offer: async () => null,
    ...overrides,
  };
}

describe('resolveOverviewCard', () => {
  it('never asks a live solution for its offer', async () => {
    const offerFact = jest.fn(async () => offer);
    const live = solution({ datasource: async () => datasource, needsAttention: async () => true, offer: offerFact });

    await expect(resolveOverviewCard(live)).resolves.toEqual({ solution: live, kind: 'live', needsAttention: true });
    expect(offerFact).not.toHaveBeenCalled();
  });

  it('never asks a solution without a datasource whether it needs attention', async () => {
    const needsAttention = jest.fn(async () => true);
    const offered = solution({ needsAttention, offer: async () => offer });

    await expect(resolveOverviewCard(offered)).resolves.toEqual({ solution: offered, kind: 'offer', offer });
    expect(needsAttention).not.toHaveBeenCalled();
  });
});
