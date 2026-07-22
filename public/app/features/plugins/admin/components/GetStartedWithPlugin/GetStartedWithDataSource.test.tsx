import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { useAssistant } from '@grafana/assistant';
import { PluginSignatureStatus } from '@grafana/data';
import { config } from '@grafana/runtime';
import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';
import { addDataSource } from 'app/features/datasources/state/actions';
import { AccessControlAction } from 'app/types/accessControl';

import { type CatalogPlugin } from '../../types';

import { GetStartedWithDataSource } from './GetStartedWithDataSource';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn(<T extends object>(type: string, data: T) => ({
    type,
    ...data,
  })),
}));

jest.mock('app/features/datasources/state/actions', () => ({
  addDataSource: jest.fn(() => async () => 'new-ds-uid'),
}));

const mockUseAssistant = jest.mocked(useAssistant);
const mockAddDataSource = jest.mocked(addDataSource);

const plugin: CatalogPlugin = {
  description: 'The test plugin',
  downloads: 5,
  id: 'test-plugin',
  info: {
    logos: { small: '', large: '' },
    keywords: ['test', 'plugin'],
  },
  name: 'Testing Plugin',
  orgName: 'Test',
  popularity: 0,
  signature: PluginSignatureStatus.valid,
  publishedAt: '2020-09-01',
  updatedAt: '2021-06-28',
  hasUpdate: false,
  isInstalled: false,
  isCore: false,
  isDev: false,
  isEnterprise: false,
  isDisabled: false,
  isDeprecated: false,
  isPublished: true,
  isPreinstalled: { found: false, withVersion: false },
  managed: {
    enabled: false,
    strategy: undefined,
  },
};

describe('GetStartedWithDataSource', () => {
  const oldPluginAdminExternalManageEnabled = config.pluginAdminExternalManageEnabled;

  config.pluginAdminExternalManageEnabled = true;

  const contextSrv = new ContextSrv();
  contextSrv.user.permissions = {
    [AccessControlAction.DataSourcesCreate]: true,
    [AccessControlAction.DataSourcesWrite]: true,
  };
  setContextSrv(contextSrv);

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: false,
      openAssistant: undefined,
      closeAssistant: undefined,
      toggleAssistant: undefined,
    });
  });

  afterAll(() => {
    config.pluginAdminExternalManageEnabled = oldPluginAdminExternalManageEnabled;
  });

  it('should disable button when pluginAdminExternalManaged is enabled, but plugin.isFullyInstalled is false', () => {
    render(
      <TestProvider>
        <GetStartedWithDataSource plugin={{ ...plugin, isFullyInstalled: false }} />
      </TestProvider>
    );

    const el = screen.getByRole('button', { hidden: true });
    expect(el).toHaveTextContent(/Add new data source/i);
    expect(el).toBeDisabled();
  });

  it('should disable button when pluginAdminExternalManaged enabled, but plugin.isFullyInstalled is true', () => {
    render(
      <TestProvider>
        <GetStartedWithDataSource plugin={{ ...plugin, isFullyInstalled: true }} />
      </TestProvider>
    );

    const el = screen.getByRole('button', { hidden: true });
    expect(el).toHaveTextContent(/Add new data source/i);
    expect(el).toBeEnabled();
  });

  it('renders a plain "Add new data source" button (no dropdown) and adds the data source directly when the assistant is not available', async () => {
    // Assistant is unavailable via the default mock in beforeEach.
    const user = userEvent.setup();
    render(
      <TestProvider>
        <GetStartedWithDataSource plugin={{ ...plugin, isFullyInstalled: true }} />
      </TestProvider>
    );

    // The dropdown-only options must not be rendered.
    expect(screen.queryByText('Set up with assistant')).not.toBeInTheDocument();
    expect(screen.queryByText('Set up manually')).not.toBeInTheDocument();

    // Clicking adds the data source directly instead of opening a menu.
    await user.click(screen.getByRole('button', { name: /Add new data source/i }));
    expect(mockAddDataSource).toHaveBeenCalledWith({ id: plugin.id, name: plugin.name }, expect.anything());
  });

  it('creates the data source and opens the assistant when "Set up with assistant" is selected', async () => {
    const openAssistant = jest.fn();
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: true,
      openAssistant,
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });

    const user = userEvent.setup();
    render(
      <TestProvider>
        <GetStartedWithDataSource plugin={{ ...plugin, isFullyInstalled: true }} />
      </TestProvider>
    );

    await user.click(screen.getByRole('button', { name: /Add new data source/i }));
    await user.click(await screen.findByText('Set up with assistant'));

    await waitFor(() => expect(openAssistant).toHaveBeenCalledTimes(1));

    expect(openAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: `grafana/plugin-page/${plugin.id}`,
        mode: 'assistant',
        autoSend: true,
        context: [expect.objectContaining({ type: 'structured', data: { pluginId: plugin.id, title: 'Plugin ID' } })],
      })
    );
  });
});
