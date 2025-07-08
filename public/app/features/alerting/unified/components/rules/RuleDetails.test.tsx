import { render } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { PluginExtensionTypes } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';

import { useIsRuleEditable } from '../../hooks/useIsRuleEditable';
import { getCloudRule, getGrafanaRule } from '../../mocks';
import { mimirDataSource } from '../../mocks/server/configure';

import { RuleDetails } from './RuleDetails';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginLinks: jest.fn(),
  useReturnToPrevious: jest.fn(),
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

      // Assert
      expect(ui.actionButtons.edit.query()).not.toBeInTheDocument();
    });

    it('Should not render Delete button for users with the delete permission', async () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });

      // Act
      render(<RuleDetails rule={grafanaRule} />);

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

      // Assert
      expect(ui.actionButtons.edit.query()).not.toBeInTheDocument();
    });

    it('Should not render Delete button for users with the delete permission', async () => {
      // Arrange
      mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });

      // Act
      render(<RuleDetails rule={cloudRule} />);

      // Assert
      expect(ui.actionButtons.delete.query()).not.toBeInTheDocument();
    });
  });
});
