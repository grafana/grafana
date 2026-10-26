import { render, screen } from 'test/test-utils';

import { RuleInterval } from './RuleInterval';

describe('RuleInterval', () => {
  it('renders the interval string with a clock icon', () => {
    render(<RuleInterval interval="5m" />);

    expect(screen.getByText('5m')).toBeInTheDocument();
  });

  it('has an accessible name that describes the evaluation cadence', () => {
    render(<RuleInterval interval="10m" />);

    expect(screen.getByRole('img', { name: 'Evaluated every 10m' })).toBeInTheDocument();
  });

  it('has a tooltip that describes the evaluation cadence', async () => {
    render(<RuleInterval interval="1h" />);

    expect(await screen.findByLabelText('Evaluated every 1h')).toBeInTheDocument();
  });
});
