import { render, screen } from '@testing-library/react';

import { type ServiceSummary, setOverview } from '../liveScenario';
import { emptyOverview, sameKeyWarnings } from '../testFixtures';

import { DrilldownServices } from './DrilldownServices';

const service = (env: string): ServiceSummary => ({
  name: '::1',
  health: 'healthy',
  p95: 'n/a',
  errorRate: 'n/a',
  trend: [],
  lastDeploy: '',
  entity: { env, namespace: 'un-instrumented', insights: 0 },
});

afterEach(() => {
  jest.restoreAllMocks();
  setOverview(emptyOverview);
});

describe('DrilldownServices', () => {
  it('shows a card for each environment of a service whose name repeats, with no duplicate key warning', () => {
    setOverview({ ...emptyOverview, services: [service('prod-us-east-0'), service('prod-ap-south-1')] });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<DrilldownServices onPick={jest.fn()} />);

    const cards = screen.getAllByRole('button', { name: /^::1/ });
    expect(cards.map((card) => card.textContent)).toEqual([
      '::1Healthyprod-us-east-0 · un-instrumentedInsights 0',
      '::1Healthyprod-ap-south-1 · un-instrumentedInsights 0',
    ]);
    expect(sameKeyWarnings(consoleError)).toEqual([]);
  });
});
