import { screen, within } from '@testing-library/react';
import { render } from 'test/test-utils';

import { setOverview } from '../liveScenario';
import { emptyOverview } from '../testFixtures';

import { DrilldownLogLabels } from './DrilldownLogLabels';

afterEach(() => setOverview(emptyOverview));

it('shows ranked label names with estimated log bytes and explains overlapping volume', () => {
  setOverview({
    ...emptyOverview,
    topLogLabels: [
      { label: 'service_name', bytes: 2500000 },
      { label: 'namespace', bytes: 1000000 },
    ],
  });

  render(<DrilldownLogLabels />);

  const section = screen.getByRole('region', { name: 'Top log labels' });
  expect(
    within(section)
      .getAllByRole('listitem')
      .map((item) => item.textContent)
  ).toEqual(['service_name2.50 MB', 'namespace1 MB']);
  expect(within(section).getByText(/A log can contribute to more than one label/)).toBeInTheDocument();
});

it('removes a previous ranking when the next overview has no label volumes', () => {
  setOverview({ ...emptyOverview, topLogLabels: [{ label: 'service_name', bytes: 1000000 }] });
  const { rerender } = render(<DrilldownLogLabels />);
  expect(screen.getByText('service_name')).toBeInTheDocument();

  setOverview(emptyOverview);
  rerender(<DrilldownLogLabels />);

  expect(screen.queryByRole('region', { name: 'Top log labels' })).not.toBeInTheDocument();
});
