import { stubDatasource, stubSolution } from '../solutions/test-utils';
import { type SolutionOffer } from '../solutions/types';

import { resolveOverviewCard } from './solutionGroups';

const offer: SolutionOffer = {
  availability: 'enable',
  description: 'Connect Prometheus-compatible metrics.',
  cta: { label: 'Enable', href: '/plugins/grafana-metricsdrilldown-app/', action: 'enable' },
};

describe('resolveOverviewCard', () => {
  it('never asks a live solution for its offer', async () => {
    const offerFact = jest.fn(async () => offer);
    const live = stubSolution('metrics', {
      datasource: async () => stubDatasource,
      needsAttention: async () => true,
      offer: offerFact,
    });

    await expect(resolveOverviewCard(live)).resolves.toEqual({ solution: live, kind: 'live', needsAttention: true });
    expect(offerFact).not.toHaveBeenCalled();
  });

  it('never asks a solution without a datasource whether it needs attention', async () => {
    const needsAttention = jest.fn(async () => true);
    const offered = stubSolution('metrics', { needsAttention, offer: async () => offer });

    await expect(resolveOverviewCard(offered)).resolves.toEqual({ solution: offered, kind: 'offer', offer });
    expect(needsAttention).not.toHaveBeenCalled();
  });
});
