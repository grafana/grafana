import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { Props } from 'react-virtualized-auto-sizer';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';
import { CombinedRuleGroup, CombinedRuleNamespace, RulerDataSourceConfig } from 'app/types/unified-alerting';

import * as analytics from '../../Analytics';
import { GRAFANA_RULER_CONFIG } from '../../api/featureDiscoveryApi';
import { useHasRuler } from '../../hooks/useHasRuler';
import { mockExportApi, mockFolderApi, setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockCombinedRule, mockDataSource, mockFolder, mockGrafanaRulerRule } from '../../mocks';
import { mimirDataSource } from '../../mocks/server/configure';

import { RulesGroup } from './RulesGroup';

jest.mock('../../hooks/useHasRuler');

jest.spyOn(analytics, 'logInfo');

jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: Props) =>
    children({
      height: 600,
      scaledHeight: 600,
      scaledWidth: 1,
      width: 1,
    });
});
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: ({ value }: { value: string }) => <textarea data-testid="code-editor" value={value} readOnly />,
}));

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
  editGroupButton: byTestId('edit-group'),
  deleteGroupButton: byTestId('delete-group'),
  exportGroupButton: byRole('button', { name: 'Export rule group' }),
  confirmDeleteModal: {
    header: byText('Delete group'),
    confirmButton: byText('Delete'),
  },
  export: {
    dialog: byRole('dialog', { name: /Drawer title Export .* rules/ }),
    jsonTab: byRole('tab', { name: /JSON/ }),
    yamlTab: byRole('tab', { name: /YAML/ }),
    editor: byTestId('code-editor'),
    copyCodeButton: byRole('button', { name: 'Copy code' }),
    downloadButton: byRole('button', { name: 'Download' }),
  },
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

    it('Should hide delete and edit group buttons', async () => {
      // Act
      mockUseHasRuler(true, GRAFANA_RULER_CONFIG);
      mockFolderApi(server).folder('cpu-usage', mockFolder({ uid: 'cpu-usage', canSave: false }));
      renderRulesGroup(namespace, group);
      expect(await screen.findByTestId('rule-group')).toBeInTheDocument();

      // Assert
      expect(ui.deleteGroupButton.query()).not.toBeInTheDocument();
      expect(ui.editGroupButton.query()).not.toBeInTheDocument();
    });

    it('Should allow exporting rules group', async () => {
      // Arrange
      mockUseHasRuler(true, GRAFANA_RULER_CONFIG);
      mockFolderApi(server).folder('cpu-usage', mockFolder({ uid: 'cpu-usage' }));
      mockExportApi(server).exportRulesGroup('cpu-usage', 'TestGroup', {
        yaml: 'Yaml Export Content',
        json: 'Json Export Content',
      });

      const user = userEvent.setup();

      // Act
      renderRulesGroup(namespace, group);
      await user.click(await ui.exportGroupButton.find());

      // Assert
      const drawer = await ui.export.dialog.find();

      expect(ui.export.yamlTab.get(drawer)).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => {
        expect(ui.export.editor.get(drawer)).toHaveTextContent('Yaml Export Content');
      });

      await user.click(ui.export.jsonTab.get(drawer));
      await waitFor(() => {
        expect(ui.export.editor.get(drawer)).toHaveTextContent('Json Export Content');
      });

      expect(ui.export.copyCodeButton.get(drawer)).toBeInTheDocument();
      expect(ui.export.downloadButton.get(drawer)).toBeInTheDocument();
    });
  });

  describe('Cloud rules', () => {
    const { rulerConfig } = mimirDataSource();

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
      rulesSource: mockDataSource(),
      groups: [group],
    };

    it('When ruler enabled should display delete and edit group buttons', () => {
      // Arrange
      mockUseHasRuler(true, rulerConfig);

      // Act
      renderRulesGroup(namespace, group);

      // Assert
      expect(mocks.useHasRuler).toHaveBeenCalled();
      expect(ui.deleteGroupButton.get()).toBeInTheDocument();
      expect(ui.editGroupButton.get()).toBeInTheDocument();
    });

    it('When ruler disabled should hide delete and edit group buttons', () => {
      // Arrange
      mockUseHasRuler(false, rulerConfig);

      // Act
      renderRulesGroup(namespace, group);

      // Assert
      expect(mocks.useHasRuler).toHaveBeenCalled();
      expect(ui.deleteGroupButton.query()).not.toBeInTheDocument();
      expect(ui.editGroupButton.query()).not.toBeInTheDocument();
    });

    it('Delete button click should display confirmation modal', async () => {
      // Arrange
      mockUseHasRuler(true, rulerConfig);

      // Act
      renderRulesGroup(namespace, group);
      await userEvent.click(ui.deleteGroupButton.get());

      // Assert
      expect(ui.confirmDeleteModal.header.get()).toBeInTheDocument();
      expect(ui.confirmDeleteModal.confirmButton.get()).toBeInTheDocument();
    });
  });
});
