import { render, screen } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { CombinedRuleGroup, CombinedRuleNamespace, RulerDataSourceConfig } from 'app/types/unified-alerting';

import * as analytics from '../../Analytics';
import { GRAFANA_RULER_CONFIG } from '../../api/featureDiscoveryApi';
import { useHasRuler } from '../../hooks/useHasRuler';
import { mockFolderApi, setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockCombinedRule, mockFolder, mockGrafanaRulerRule } from '../../mocks';
import { mimirDataSource } from '../../mocks/server/configure';

import { RulesGroup } from './RulesGroup';

jest.mock('../../hooks/useHasRuler');

jest.spyOn(analytics, 'logInfo');

const mocks = {
  useHasRuler: jest.mocked(useHasRuler),
};

function mockUseHasRuler(hasRuler: boolean, rulerConfig: RulerDataSourceConfig) {
  mocks.useHasRuler.mockReturnValue({
    hasRuler,
    rulerConfig,
  });
}

beforeEach(() => {
  mocks.useHasRuler.mockReset();
  // FIXME: scope down
  grantUserPermissions(Object.values(AccessControlAction));
});

const ui = {
  detailsButton: byRole('link', { name: 'rule group details' }),
  editGroupButton: byRole('link', { name: 'edit rule group' }),
};

const server = setupMswServer();

afterEach(() => {
  server.resetHandlers();
});

describe('Rules group tests', () => {
  function renderRulesGroup(namespace: CombinedRuleNamespace, group: CombinedRuleGroup) {
    return render(<RulesGroup group={group} namespace={namespace} expandAll={false} viewMode={'grouped'} />, {
      historyOptions: { initialEntries: ['/alerting/list'] },
    });
  }

  describe('Grafana rules', () => {
    const group: CombinedRuleGroup = {
      name: 'TestGroup',
      rules: [
        mockCombinedRule({
          rulerRule: mockGrafanaRulerRule({
            namespace_uid: 'cpu-usage',
          }),
        }),
      ],
      totals: {},
    };

    const namespace: CombinedRuleNamespace = {
      name: 'TestNamespace',
      rulesSource: 'grafana',
      groups: [group],
    };

    beforeEach(() => {
      mockUseHasRuler(true, GRAFANA_RULER_CONFIG);
    });

    it('Should hide edit group button when no folder save permissions', async () => {
      // Act
      mockFolderApi(server).folder('cpu-usage', mockFolder({ uid: 'cpu-usage', canSave: false }));
      renderRulesGroup(namespace, group);
      expect(await screen.findByTestId('rule-group')).toBeInTheDocument();

      // Assert
      expect(ui.detailsButton.query()).toBeInTheDocument();
      expect(ui.editGroupButton.query()).not.toBeInTheDocument();
    });

    it('Should render view and edit buttons when folder has save permissions and user can edit rules', async () => {
      // Arrange
      mockFolderApi(server).folder('cpu-usage', mockFolder({ uid: 'cpu-usage', canSave: true }));

      // Act
      renderRulesGroup(namespace, group);
      expect(await screen.findByTestId('rule-group')).toBeInTheDocument();

      // Assert
      const detailsLink = await ui.detailsButton.find();
      const editLink = await ui.editGroupButton.find();

      expect(detailsLink).toHaveAttribute(
        'href',
        '/alerting/grafana/namespaces/cpu-usage/groups/TestGroup/view?returnTo=%2Falerting%2Flist'
      );
      expect(editLink).toHaveAttribute(
        'href',
        '/alerting/grafana/namespaces/cpu-usage/groups/TestGroup/edit?returnTo=%2Falerting%2Flist'
      );
    });

    it('Should only render view button when folder has save permissions and user cannot edit rules', async () => {
      // Arrange
      grantUserPermissions([AccessControlAction.AlertingRuleRead]);
      mockFolderApi(server).folder('cpu-usage', mockFolder({ uid: 'cpu-usage', canSave: true }));

      // Act
      renderRulesGroup(namespace, group);
      expect(await screen.findByTestId('rule-group')).toBeInTheDocument();

      // Assert
      expect(ui.detailsButton.query()).toBeInTheDocument();
      expect(ui.editGroupButton.query()).not.toBeInTheDocument();
    });
  });

  describe('Cloud rules', () => {
    const { dataSource, rulerConfig } = mimirDataSource();

    beforeEach(() => {
      contextSrv.isEditor = true;
    });

    const group: CombinedRuleGroup = {
      name: 'TestGroup',
      rules: [mockCombinedRule()],
      totals: {},
    };

    const namespace: CombinedRuleNamespace = {
      name: 'TestNamespace',
      rulesSource: dataSource,
      groups: [group],
    };

    it('When ruler enabled should display details and edit group buttons', async () => {
      // Arrange
      mockUseHasRuler(true, rulerConfig);

      // Act
      renderRulesGroup(namespace, group);
      const detailsLink = await ui.detailsButton.find();
      const editLink = await ui.editGroupButton.find();

      // Assert
      expect(mocks.useHasRuler).toHaveBeenCalled();
      expect(detailsLink).toHaveAttribute(
        'href',
        '/alerting/mimir/namespaces/TestNamespace/groups/TestGroup/view?returnTo=%2Falerting%2Flist'
      );
      expect(editLink).toHaveAttribute(
        'href',
        '/alerting/mimir/namespaces/TestNamespace/groups/TestGroup/edit?returnTo=%2Falerting%2Flist'
      );
    });

    it('When ruler disabled should hide edit group button', () => {
      // Arrange
      mockUseHasRuler(false, rulerConfig);

      // Act
      renderRulesGroup(namespace, group);

      // Assert
      expect(mocks.useHasRuler).toHaveBeenCalled();
      expect(ui.detailsButton.query()).toBeInTheDocument();
      expect(ui.editGroupButton.query()).not.toBeInTheDocument();
    });
  });
});
