import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAssistant } from '@grafana/assistant';
import { reportInteraction } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { DataSourceAddButton } from './DataSourceAddButton';

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasPermission: jest.fn(),
  },
}));

const mockHasPermission = jest.mocked(contextSrv.hasPermission);
const mockReportInteraction = jest.mocked(reportInteraction);
const mockUseAssistant = jest.mocked(useAssistant);

describe('DataSourceAddButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasPermission.mockReturnValue(true);
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: false,
      openAssistant: undefined,
      closeAssistant: undefined,
      toggleAssistant: undefined,
    });
  });

  it('should report list-page add click for CUJ attribution', () => {
    render(<DataSourceAddButton />);

    const link = screen.getByRole('link', { name: /add new data source/i });
    // Stop jsdom from attempting the (unimplemented) navigation the href would trigger.
    link.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(link);

    expect(mockReportInteraction).toHaveBeenCalledWith(
      'connections_datasource_list_add_datasource_clicked',
      {},
      { silent: true }
    );
  });

  it('should not render when user lacks create permission', () => {
    mockHasPermission.mockImplementation((action) => action !== AccessControlAction.DataSourcesCreate);

    render(<DataSourceAddButton />);

    expect(screen.queryByRole('link', { name: /add new data source/i })).not.toBeInTheDocument();
  });

  it('renders a plain link button (no dropdown) when the assistant is not available', () => {
    render(<DataSourceAddButton />);

    expect(screen.getByRole('link', { name: /add new data source/i })).toBeInTheDocument();
    expect(screen.queryByText('Set up with assistant')).not.toBeInTheDocument();
    expect(screen.queryByText('Set up manually')).not.toBeInTheDocument();
  });

  it('renders "Set up manually" as a link to the new data source page and reports the click', async () => {
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: true,
      openAssistant: jest.fn(),
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });

    const user = userEvent.setup();
    render(<DataSourceAddButton />);

    await user.click(screen.getByRole('button', { name: /add new data source/i }));
    const manualLink = await screen.findByRole('menuitem', { name: /set up manually/i });
    expect(manualLink).toHaveAttribute('href', '/connections/datasources/new');

    // Stop jsdom from attempting the (unimplemented) navigation the href would trigger.
    manualLink.addEventListener('click', (e) => e.preventDefault());
    await user.click(manualLink);

    expect(mockReportInteraction).toHaveBeenCalledWith(
      'connections_datasource_list_add_datasource_clicked',
      {},
      { silent: true }
    );
    expect(mockReportInteraction).toHaveBeenCalledWith('assistant_setup_dropdown_option_selected', {
      source: 'datasources_list',
      option: 'manual',
    });
  });

  it('opens the assistant when "Set up with assistant" is selected', async () => {
    const openAssistant = jest.fn();
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: true,
      openAssistant,
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });

    const user = userEvent.setup();
    render(<DataSourceAddButton />);

    await user.click(screen.getByRole('button', { name: /add new data source/i }));
    await user.click(await screen.findByText('Set up with assistant'));

    await waitFor(() => expect(openAssistant).toHaveBeenCalledTimes(1));
    expect(mockReportInteraction).toHaveBeenCalledWith('assistant_setup_dropdown_option_selected', {
      source: 'datasources_list',
      option: 'assistant',
    });

    expect(openAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'grafana/datasources-list/add-data-source',
        mode: 'assistant',
        prompt: 'I want to connect Grafana to ',
        autoSend: false,
      })
    );
  });
});
