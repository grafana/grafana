import { OpenFeatureTestProvider } from '@openfeature/react-sdk';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { useAssistant } from '@grafana/assistant';
import { PluginType } from '@grafana/data';
import { usePluginComponent } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { getCatalogPluginMock } from '../../mocks/mockHelpers';

import { AssistantGetStarted } from './index';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasPermission: jest.fn(() => true),
    user: { orgId: 1, timezone: 'browser', weekStart: '', locale: '' },
  },
}));

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponent: jest.fn().mockReturnValue({ component: null, isLoading: false }),
}));

const mockUseAssistant = jest.mocked(useAssistant);
const mockUsePluginComponent = jest.mocked(usePluginComponent);
const mockOpenAssistant = jest.fn();

function renderWithStore(component: JSX.Element) {
  const store = configureStore();
  return render(
    <Provider store={store}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <OpenFeatureTestProvider>{component}</OpenFeatureTestProvider>
      </MemoryRouter>
    </Provider>
  );
}

const assistantPlugin = getCatalogPluginMock({
  id: 'grafana-assistant-app',
  name: 'Grafana Assistant',
  type: PluginType.app,
  isInstalled: false,
});

const installedPlugin = getCatalogPluginMock({
  id: 'grafana-assistant-app',
  name: 'Grafana Assistant',
  type: PluginType.app,
  isInstalled: true,
});

const mockPluginConfig = {
  meta: {
    id: 'grafana-assistant-app',
    name: 'Grafana Assistant',
    type: PluginType.app,
    enabled: false,
    module: '',
    baseUrl: '',
    info: {
      author: { name: 'Grafana Labs' },
      description: '',
      logos: { small: '', large: '' },
      links: [],
      screenshots: [],
      updated: '',
      version: '1.0.0',
    },
  },
  addConfigPage: () => mockPluginConfig,
  setChannelSupport: () => mockPluginConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const enabledPluginConfig = {
  ...mockPluginConfig,
  meta: { ...mockPluginConfig.meta, enabled: true },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('AssistantGetStarted', () => {
  beforeEach(() => {
    const { contextSrv } = jest.requireMock('app/core/services/context_srv');
    contextSrv.hasPermission.mockReturnValue(true);
    mockOpenAssistant.mockClear();
    mockUsePluginComponent.mockReturnValue({ component: null, isLoading: false });
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: true,
      openAssistant: mockOpenAssistant,
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });
  });

  describe('state: not-installed', () => {
    it('shows Install button on step 1', () => {
      renderWithStore(<AssistantGetStarted plugin={assistantPlugin} />);
      expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
    });

    it('shows step 2 and 3 titles but no Connect or Open Assistant buttons', () => {
      renderWithStore(<AssistantGetStarted plugin={assistantPlugin} />);
      expect(screen.getByText('Connect to Grafana Cloud')).toBeInTheDocument();
      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Connect' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Open Assistant' })).not.toBeInTheDocument();
    });
  });

  describe('state: not-connected', () => {
    it('shows Connect button on step 2', () => {
      renderWithStore(
        <AssistantGetStarted plugin={installedPlugin} pluginConfig={mockPluginConfig} pluginConfigLoading={false} />
      );
      expect(screen.getByRole('link', { name: 'Connect' })).toBeInTheDocument();
    });

    it('does not show Install button', () => {
      renderWithStore(
        <AssistantGetStarted plugin={installedPlugin} pluginConfig={mockPluginConfig} pluginConfigLoading={false} />
      );
      expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
    });
  });

  describe('state: connected', () => {
    it('shows Open Assistant button on step 3', () => {
      renderWithStore(
        <AssistantGetStarted plugin={installedPlugin} pluginConfig={enabledPluginConfig} pluginConfigLoading={false} />
      );
      expect(screen.getByRole('button', { name: 'Open Assistant' })).toBeInTheDocument();
    });

    it('opens Assistant through the SDK when Open Assistant is clicked', async () => {
      const user = userEvent.setup();

      renderWithStore(
        <AssistantGetStarted plugin={installedPlugin} pluginConfig={enabledPluginConfig} pluginConfigLoading={false} />
      );

      await user.click(screen.getByRole('button', { name: 'Open Assistant' }));

      expect(mockOpenAssistant).toHaveBeenCalledWith({
        origin: 'grafana/plugins/admin/assistant-get-started',
      });
    });

    it('shows Try asking section', () => {
      renderWithStore(
        <AssistantGetStarted plugin={installedPlugin} pluginConfig={enabledPluginConfig} pluginConfigLoading={false} />
      );
      expect(screen.getByText('Try asking:')).toBeInTheDocument();
      expect(screen.getByText('What data sources do I have?')).toBeInTheDocument();
    });

    it('opens Assistant with the selected prompt through the SDK', async () => {
      const user = userEvent.setup();

      renderWithStore(
        <AssistantGetStarted plugin={installedPlugin} pluginConfig={enabledPluginConfig} pluginConfigLoading={false} />
      );

      await user.click(screen.getByRole('button', { name: 'What data sources do I have?' }));

      expect(mockOpenAssistant).toHaveBeenCalledWith({
        origin: 'grafana/plugins/admin/assistant-get-started',
        prompt: 'What data sources do I have?',
        autoSend: true,
      });
    });
  });

  describe('state: installed but config not loaded', () => {
    it('shows Connect button when installed but config is null', () => {
      renderWithStore(<AssistantGetStarted plugin={installedPlugin} pluginConfig={null} pluginConfigLoading={false} />);
      expect(screen.getByRole('link', { name: 'Connect' })).toBeInTheDocument();
    });

    it('shows step 1 as complete', () => {
      renderWithStore(<AssistantGetStarted plugin={installedPlugin} pluginConfig={null} pluginConfigLoading={false} />);
      expect(screen.getByLabelText('Step 1: complete')).toBeInTheDocument();
    });
  });

  describe('permission gating', () => {
    it('hides Install button when user lacks install permission', () => {
      const { contextSrv } = jest.requireMock('app/core/services/context_srv');
      contextSrv.hasPermission.mockReturnValue(false);

      renderWithStore(<AssistantGetStarted plugin={assistantPlugin} />);
      expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
    });

    it('shows explanatory text when user cannot install', () => {
      const { contextSrv } = jest.requireMock('app/core/services/context_srv');
      contextSrv.hasPermission.mockReturnValue(false);

      renderWithStore(<AssistantGetStarted plugin={assistantPlugin} />);
      expect(screen.getByText('An administrator needs to install this plugin.')).toBeInTheDocument();
    });
  });

  describe('connect link', () => {
    it('renders Connect as a link to Cloud signup in not-connected state', () => {
      renderWithStore(
        <AssistantGetStarted plugin={installedPlugin} pluginConfig={mockPluginConfig} pluginConfigLoading={false} />
      );

      const connectLink = screen.getByRole('link', { name: 'Connect' });
      expect(connectLink).toBeInTheDocument();
      expect(connectLink).toHaveAttribute('target', '_blank');
    });
  });

  describe('connect step extension point', () => {
    it('renders the plugin-exposed connect component instead of the link when available', () => {
      const ExposedConnect = () => <button>Plugin Connect</button>;
      mockUsePluginComponent.mockReturnValue({ component: ExposedConnect, isLoading: false });

      renderWithStore(
        <AssistantGetStarted plugin={installedPlugin} pluginConfig={mockPluginConfig} pluginConfigLoading={false} />
      );

      expect(screen.getByRole('button', { name: 'Plugin Connect' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Connect' })).not.toBeInTheDocument();
    });

    it('falls back to the Cloud sign-up link when the plugin exposes no component', () => {
      mockUsePluginComponent.mockReturnValue({ component: null, isLoading: false });

      renderWithStore(
        <AssistantGetStarted plugin={installedPlugin} pluginConfig={mockPluginConfig} pluginConfigLoading={false} />
      );

      expect(screen.getByRole('link', { name: 'Connect' })).toBeInTheDocument();
    });

    it('renders no connect action while the plugin component is still loading', () => {
      mockUsePluginComponent.mockReturnValue({ component: null, isLoading: true });

      renderWithStore(
        <AssistantGetStarted plugin={installedPlugin} pluginConfig={mockPluginConfig} pluginConfigLoading={false} />
      );

      expect(screen.queryByRole('link', { name: 'Connect' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Plugin Connect' })).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('provides aria-labels for step cards', () => {
      renderWithStore(<AssistantGetStarted plugin={assistantPlugin} />);
      expect(screen.getByLabelText('Step 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Step 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Step 3')).toBeInTheDocument();
    });
  });
});
