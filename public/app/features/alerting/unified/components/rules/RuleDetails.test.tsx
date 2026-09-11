import { render, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { PluginExtensionTypes } from '@grafana/data';
import { config, usePluginLinks } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';

import { useIsRuleEditable } from '../../hooks/useIsRuleEditable';
import { getCloudRule, getGrafanaRule } from '../../mocks';
import { mimirDataSource } from '../../mocks/server/configure';

import { RuleDetails } from './RuleDetails';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginLinks: jest.fn(),
  useReturnToPrevious: jest.fn(),
  useAppPluginEnabled: jest.fn().mockReturnValue({ loading: false, error: undefined, value: false }),
}));

jest.mock('../../hooks/useIsRuleEditable');

const mocks = {
  usePluginLinksMock: jest.mocked(usePluginLinks),
  useIsRuleEditable: jest.mocked(useIsRuleEditable),
};

const ui = {
  actionButtons: {
    edit: byRole('link', { name: /edit/i }),
    delete: byRole('button', { name: /delete/i }),
    stateHistory: byRole('button', { name: /show state history/i }),
  },
};

setupMswServer();

const { dataSource: mimirDs } = mimirDataSource();

beforeAll(() => {
  jest.clearAllMocks();
});

beforeEach(() => {
  mocks.usePluginLinksMock.mockReturnValue({
    links: [
      {
        pluginId: 'grafana-ml-app',
        id: '1',
        type: PluginExtensionTypes.link,
        title: 'Run investigation',
        category: 'Sift',
        description: 'Run a Sift investigation for this alert',
        onClick: jest.fn(),
      },
    ],
    isLoading: false,
  });
});

describe('RuleDetails RBAC', () => {
  describe('Grafana rules action buttons in details', () => {
    const grafanaRule = getGrafanaRule({ name: 'Grafana' });

    it('Should not render Edit button for users with the update permission', async () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });

      // Act
      render(<RuleDetails rule={grafanaRule} />);
      await waitFor(() => {});

      // Assert
      expect(ui.actionButtons.edit.query()).not.toBeInTheDocument();
    });

    it('Should not render Delete button for users with the delete permission', async () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });

      // Act
      render(<RuleDetails rule={grafanaRule} />);
      await waitFor(() => {});

      // Assert
      expect(ui.actionButtons.delete.query()).not.toBeInTheDocument();
    });
  });

  describe('Cloud rules action buttons', () => {
    const cloudRule = getCloudRule({ name: 'Cloud' }, { rulesSource: mimirDs });

    it('Should not render Edit button for users with the update permission', async () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });

      // Act
      render(<RuleDetails rule={cloudRule} />);
      await waitFor(() => {});

      // Assert
      expect(ui.actionButtons.edit.query()).not.toBeInTheDocument();
    });

    it('Should not render Delete button for users with the delete permission', async () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });

      // Act
      render(<RuleDetails rule={cloudRule} />);
      await waitFor(() => {});

      // Assert
      expect(ui.actionButtons.delete.query()).not.toBeInTheDocument();
    });
  });
});

describe('RuleDetails state history button', () => {
  const grafanaRule = getGrafanaRule({ name: 'Grafana' });
  const originalStateHistory = config.unifiedAlerting.stateHistory;
  const originalDeprecatedBackend = config.unifiedAlerting.alertStateHistoryBackend;

  beforeEach(() => {
    mocks.useIsRuleEditable.mockReturnValue({ loading: false });
  });

  afterEach(() => {
    config.unifiedAlerting.stateHistory = originalStateHistory;
    config.unifiedAlerting.alertStateHistoryBackend = originalDeprecatedBackend;
  });

  it('renders the button when a backend records state history', async () => {
    config.unifiedAlerting.stateHistory = { backend: 'annotations' };

    render(<RuleDetails rule={grafanaRule} />);

    expect(await ui.actionButtons.stateHistory.find()).toBeInTheDocument();
  });

  it.each([
    { name: 'the prometheus backend cannot answer history queries', stateHistory: { backend: 'prometheus' } },
    { name: 'state history is turned off', stateHistory: undefined },
  ])('does not render the button when $name', async ({ stateHistory }) => {
    config.unifiedAlerting.stateHistory = stateHistory;
    config.unifiedAlerting.alertStateHistoryBackend = undefined;

    render(<RuleDetails rule={grafanaRule} />);
    await waitFor(() => {});

    expect(ui.actionButtons.stateHistory.query()).not.toBeInTheDocument();
  });
});
