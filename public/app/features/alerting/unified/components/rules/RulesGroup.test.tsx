import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { byRole } from 'testing-library-selector';

import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';
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
  const store = configureStore();

  function renderRulesGroup(namespace: CombinedRuleNamespace, group: CombinedRuleGroup) {
    return render(
      <Provider store={store}>
        <RulesGroup group={group} namespace={namespace} expandAll={false} viewMode={'grouped'} />
      </Provider>
    );
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

    it('Should hide edit group button when no folder save permissions', async () => {
      // Act
      mockUseHasRuler(true, GRAFANA_RULER_CONFIG);
      mockFolderApi(server).folder('cpu-usage', mockFolder({ uid: 'cpu-usage', canSave: false }));
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
      expect(detailsLink).toHaveAttribute('href', '/alerting/mimir/namespaces/TestNamespace/groups/TestGroup/view');
      expect(editLink).toHaveAttribute('href', '/alerting/mimir/namespaces/TestNamespace/groups/TestGroup/edit');
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
