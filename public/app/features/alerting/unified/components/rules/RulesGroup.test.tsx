import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { AutoSizerProps } from 'react-virtualized-auto-sizer';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { logInfo } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';

import { LogMessages } from '../../Analytics';
import { useHasRuler } from '../../hooks/useHasRuler';
import { mockFolderApi, mockProvisioningApi, setupMswServer } from '../../mockApi';
import { disableRBAC, mockCombinedRule, mockDataSource, mockFolder, mockGrafanaRulerRule } from '../../mocks';

import { RulesGroup } from './RulesGroup';

jest.mock('../../hooks/useHasRuler');
jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    logInfo: jest.fn(),
  };
});
jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: AutoSizerProps) => children({ height: 600, width: 1 });
});
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: function CodeEditor({ value }: { value: string; onBlur: (newValue: string) => void }) {
    console.log('CodeEditor', value);
    return <textarea data-testid="code-editor" value={value} readOnly />;
  },
}));

const mocks = {
  useHasRuler: jest.mocked(useHasRuler),
};

function mockUseHasRuler(hasRuler: boolean, rulerRulesLoaded: boolean) {
  mocks.useHasRuler.mockReturnValue({
    hasRuler: () => hasRuler,
    rulerRulesLoaded: () => rulerRulesLoaded,
  });
}

beforeEach(() => {
  mocks.useHasRuler.mockReset();
});

const ui = {
  editGroupButton: byTestId('edit-group'),
  deleteGroupButton: byTestId('delete-group'),
  exportGroupButton: byRole('button', { name: 'Export rule group' }),
  confirmDeleteModal: {
    header: byText('Delete group'),
    confirmButton: byText('Delete'),
  },
  moreActionsButton: byRole('button', { name: 'More' }),
  export: {
    dialog: byRole('dialog', { name: 'Drawer title Export' }),
    jsonTab: byRole('tab', { name: /JSON/ }),
    yamlTab: byRole('tab', { name: /YAML/ }),
    editor: byTestId('code-editor'),
    copyCodeButton: byRole('button', { name: 'Copy code' }),
    downloadButton: byRole('button', { name: 'Download' }),
  },
  loadingSpinner: byTestId('spinner'),
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

    it('Should hide delete and edit group buttons', () => {
      // Act
      mockUseHasRuler(true, true);
      renderRulesGroup(namespace, group);

      // Assert
      expect(ui.deleteGroupButton.query()).not.toBeInTheDocument();
      expect(ui.editGroupButton.query()).not.toBeInTheDocument();
    });

    it('Should allow exporting rules group', async () => {
      // Arrange
      mockUseHasRuler(true, true);
      mockFolderApi(server).folder('cpu-usage', mockFolder({ uid: 'cpu-usage' }));
      mockProvisioningApi(server).exportRuleGroup('cpu-usage', 'TestGroup', {
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
      expect(ui.export.editor.get(drawer)).toHaveTextContent('Yaml Export Content');

      await user.click(ui.export.jsonTab.get(drawer));
      expect(ui.export.editor.get(drawer)).toHaveTextContent('Json Export Content');

      expect(ui.export.copyCodeButton.get(drawer)).toBeInTheDocument();
      expect(ui.export.downloadButton.get(drawer)).toBeInTheDocument();
    });
  });

  describe('Cloud rules', () => {
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

    disableRBAC();

    it('When ruler enabled should display delete and edit group buttons', () => {
      // Arrange
      mockUseHasRuler(true, true);

      // Act
      renderRulesGroup(namespace, group);

      // Assert
      expect(mocks.useHasRuler).toHaveBeenCalled();
      expect(ui.deleteGroupButton.get()).toBeInTheDocument();
      expect(ui.editGroupButton.get()).toBeInTheDocument();
    });

    it('When ruler disabled should hide delete and edit group buttons', () => {
      // Arrange
      mockUseHasRuler(false, false);

      // Act
      renderRulesGroup(namespace, group);

      // Assert
      expect(mocks.useHasRuler).toHaveBeenCalled();
      expect(ui.deleteGroupButton.query()).not.toBeInTheDocument();
      expect(ui.editGroupButton.query()).not.toBeInTheDocument();
    });

    it('Delete button click should display confirmation modal', async () => {
      // Arrange
      mockUseHasRuler(true, true);

      // Act
      renderRulesGroup(namespace, group);
      await userEvent.click(ui.deleteGroupButton.get());

      // Assert
      expect(ui.confirmDeleteModal.header.get()).toBeInTheDocument();
      expect(ui.confirmDeleteModal.confirmButton.get()).toBeInTheDocument();
    });
  });

  describe('Analytics', () => {
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

    disableRBAC();

    it('Should log info when closing the edit group rule modal without saving', async () => {
      mockUseHasRuler(true, true);
      renderRulesGroup(namespace, group);

      await userEvent.click(ui.editGroupButton.get());

      expect(screen.getByText('Cancel')).toBeInTheDocument();

      await userEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
      expect(logInfo).toHaveBeenCalledWith(LogMessages.leavingRuleGroupEdit);
    });
  });
});
