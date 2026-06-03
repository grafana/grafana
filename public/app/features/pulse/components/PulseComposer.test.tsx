import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { config } from '@grafana/runtime';

import { PulseComposer } from './PulseComposer';

// The @-mention picker fetches users over the network; stub it so the
// test exercises only the synthetic assistant row.
jest.mock('../utils/lookups', () => ({
  ...jest.requireActual('../utils/lookups'),
  searchUsers: jest.fn().mockResolvedValue([]),
}));

describe('PulseComposer assistant mention', () => {
  const originalToggle = config.featureToggles.dashboardPulseAssistant;
  afterEach(() => {
    config.featureToggles.dashboardPulseAssistant = originalToggle;
  });

  it('offers @assistant when the dashboardPulseAssistant toggle is on', async () => {
    config.featureToggles.dashboardPulseAssistant = true;
    render(<PulseComposer onSubmit={jest.fn()} />);

    const textarea = screen.getByLabelText('Pulse message');
    await userEvent.type(textarea, '@assist');

    expect(await screen.findByText('Grafana Assistant')).toBeInTheDocument();
  });

  it('does not offer @assistant when the toggle is off', async () => {
    config.featureToggles.dashboardPulseAssistant = false;
    render(<PulseComposer onSubmit={jest.fn()} />);

    const textarea = screen.getByLabelText('Pulse message');
    await userEvent.type(textarea, '@assist');

    // Give the (mocked, empty) user lookup a tick to resolve.
    expect(screen.queryByText('Grafana Assistant')).not.toBeInTheDocument();
  });

  it('inserts an @assistant token into the body on selection', async () => {
    config.featureToggles.dashboardPulseAssistant = true;
    const onSubmit = jest.fn();
    render(<PulseComposer onSubmit={onSubmit} />);

    const textarea = screen.getByLabelText('Pulse message');
    await userEvent.type(textarea, 'look @assist');
    await userEvent.click(await screen.findByText('Grafana Assistant'));

    expect((textarea as HTMLTextAreaElement).value).toContain('`@Grafana Assistant`');
  });
});
