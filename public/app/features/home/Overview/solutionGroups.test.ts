import { stubDatasource, stubSolution } from '../solutions/test-utils';
import { type SolutionOffer } from '../solutions/types';

import { resolveOverviewCard } from './solutionGroups';

const offer: SolutionOffer = {
  availability: 'enable',
  description: 'Connect Prometheus-compatible metrics.',
  cta: { label: 'Enable', href: '/plugins/grafana-metricsdrilldown-app/', action: 'enable' },
};

describe('resolveOverviewCard', () => {
  it('places a solution that has both a datasource and an offer as live', async () => {
    const live = stubSolution('metrics', {
      datasource: async () => stubDatasource,
      needsAttention: async () => true,
      offer: async () => offer,
    });

    await expect(resolveOverviewCard(live)).resolves.toEqual({ solution: live, kind: 'live', needsAttention: true });
  });
});
