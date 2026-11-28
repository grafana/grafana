import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAssistant } from '@grafana/assistant';
import { locationService } from '@grafana/runtime';

import { DrilldownAskRow } from './DrilldownAskRow';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn((type: string, params: object) => ({ type, params })),
}));

const openAssistant = jest.fn();

beforeEach(() => {
  openAssistant.mockReset();
  jest.mocked(useAssistant).mockReturnValue({
    isAvailable: true,
    isLoading: false,
    openAssistant,
    closeAssistant: jest.fn(),
    toggleAssistant: jest.fn(),
  });
  locationService.replace('/drilldown?var-ds-logs=logs-1');
});

it.each(['Enter', 'Ask button'])('sends the question and scope once using %s', async (trigger) => {
  const user = userEvent.setup();
  render(<DrilldownAskRow scope={{ type: 'service', value: 'checkout', env: 'prod', namespace: 'shop' }} />);
  const input = screen.getByRole('textbox', { name: 'Ask Grafana Assistant' });

  await user.type(input, 'Why is checkout failing?');
  expect(screen.getByRole('button', { name: 'Ask' })).toBeEnabled();
  if (trigger === 'Enter') {
    await user.keyboard('{Enter}');
  } else {
    await user.click(screen.getByRole('button', { name: 'Ask' }));
  }

  expect(openAssistant).toHaveBeenCalledTimes(1);
  expect(openAssistant).toHaveBeenCalledWith({
    origin: 'grafana/drilldown-home',
    prompt: 'Why is checkout failing?',
    autoSend: true,
    context: [
      { type: 'datasource', params: { datasourceUid: 'logs-1' } },
      {
        type: 'entity',
        params: { type: 'Service', name: 'checkout', scope: { env: 'prod', namespace: 'shop' }, properties: undefined },
      },
    ],
  });
  expect(input).toHaveValue('');
});

it('disables Ask for an empty or whitespace-only question', async () => {
  const user = userEvent.setup();
  render(<DrilldownAskRow />);

  expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
  await user.type(screen.getByRole('textbox', { name: 'Ask Grafana Assistant' }), '   {Enter}');

  expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
  expect(openAssistant).not.toHaveBeenCalled();
});

it.each([
  { state: 'loading', isLoading: true },
  { state: 'unavailable', isLoading: false },
])('hides the Ask bar while Assistant is $state and restores it when available', ({ isLoading }) => {
  const availableAssistant = {
    isLoading: false,
    isAvailable: true,
    openAssistant,
    closeAssistant: jest.fn(),
    toggleAssistant: jest.fn(),
  };
  const { rerender } = render(<DrilldownAskRow />);

  expect(screen.getByRole('textbox', { name: 'Ask Grafana Assistant' })).toBeEnabled();

  jest.mocked(useAssistant).mockReturnValue({
    isAvailable: false,
    isLoading,
    openAssistant: undefined,
    closeAssistant: undefined,
    toggleAssistant: undefined,
  });
  rerender(<DrilldownAskRow />);

  expect(screen.queryByRole('textbox', { name: 'Ask Grafana Assistant' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ask' })).not.toBeInTheDocument();

  jest.mocked(useAssistant).mockReturnValue(availableAssistant);
  rerender(<DrilldownAskRow />);

  expect(screen.getByRole('textbox', { name: 'Ask Grafana Assistant' })).toBeEnabled();
});
