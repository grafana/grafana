import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { reportInteraction } from '@grafana/runtime';

import { ASSISTANT_SETUP_DROPDOWN_INTERACTION, AssistantSetupDropdown } from './AssistantSetupDropdown';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const mockReportInteraction = jest.mocked(reportInteraction);

function setup() {
  const assistantOnClick = jest.fn();
  const manualOnClick = jest.fn();

  render(
    <AssistantSetupDropdown
      source="test_surface"
      assistantItem={{ label: 'Set up with assistant', description: 'Guided', onClick: assistantOnClick }}
      manualItem={{ label: 'Set up manually', description: 'Yourself', onClick: manualOnClick }}
    >
      Add thing
    </AssistantSetupDropdown>
  );

  return { assistantOnClick, manualOnClick };
}

describe('AssistantSetupDropdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports the interaction and calls onClick when the assistant option is selected', async () => {
    const user = userEvent.setup();
    const { assistantOnClick, manualOnClick } = setup();

    await user.click(screen.getByRole('button', { name: /add thing/i }));
    await user.click(await screen.findByText('Set up with assistant'));

    expect(mockReportInteraction).toHaveBeenCalledWith(ASSISTANT_SETUP_DROPDOWN_INTERACTION, {
      source: 'test_surface',
      option: 'assistant',
    });
    expect(assistantOnClick).toHaveBeenCalledTimes(1);
    expect(manualOnClick).not.toHaveBeenCalled();
  });

  it('reports the interaction and calls onClick when the manual option is selected', async () => {
    const user = userEvent.setup();
    const { assistantOnClick, manualOnClick } = setup();

    await user.click(screen.getByRole('button', { name: /add thing/i }));
    await user.click(await screen.findByText('Set up manually'));

    expect(mockReportInteraction).toHaveBeenCalledWith(ASSISTANT_SETUP_DROPDOWN_INTERACTION, {
      source: 'test_surface',
      option: 'manual',
    });
    expect(manualOnClick).toHaveBeenCalledTimes(1);
    expect(assistantOnClick).not.toHaveBeenCalled();
  });
});
