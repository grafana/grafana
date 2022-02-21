import React from 'react';
import { render } from '@testing-library/react';
import { FolderState } from 'app/types';
import { AlertsFolderView } from './AlertsFolderView';
import { byTestId, byText } from 'testing-library-selector';
import { CombinedRuleNamespace } from 'app/types/unified-alerting';
import { configureStore } from 'app/store/configureStore';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { mockCombinedRule } from './mocks';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import userEvent from '@testing-library/user-event';

const ui = {
  filter: {
    name: byTestId('name-filter'),
    label: byTestId('label-filter'),
  },
  ruleList: {
    row: byTestId('alert-card-row'),
  },
};

const combinedNamespaceMock = jest.fn<CombinedRuleNamespace[], any>();
jest.mock('./hooks/useCombinedRuleNamespaces', () => ({
  useCombinedRuleNamespaces: () => combinedNamespaceMock(),
}));

const mockFolder = (folderOverride: Partial<FolderState> = {}): FolderState => {
  return {
    id: 1,
    title: 'Folder with alerts',
    uid: 'folder-1',
    hasChanged: false,
    canSave: false,
    url: '/folder-1',
    version: 1,
    permissions: [],
    canViewFolderPermissions: false,
    ...folderOverride,
  };
};

describe('AlertsFolderView tests', () => {
  it('Should display grafana alert rules when the namespace name matches the folder name', () => {
    // Arrange
    const store = configureStore();
    const folder = mockFolder();

    const grafanaNamespace: CombinedRuleNamespace = {
      name: folder.title,
      rulesSource: GRAFANA_RULES_SOURCE_NAME,
      groups: [
        {
          name: 'default',
          rules: [
            mockCombinedRule({ name: 'Test Alert 1' }),
            mockCombinedRule({ name: 'Test Alert 2' }),
            mockCombinedRule({ name: 'Test Alert 3' }),
          ],
        },
      ],
    };

    combinedNamespaceMock.mockReturnValue([grafanaNamespace]);

    // Act
    render(
      <Provider store={store}>
        <MemoryRouter>
          <AlertsFolderView folder={folder} />
        </MemoryRouter>
      </Provider>
    );

    // Assert
    const alertRows = ui.ruleList.row.queryAll();
    expect(alertRows).toHaveLength(3);
    expect(alertRows[0]).toHaveTextContent('Test Alert 1');
    expect(alertRows[1]).toHaveTextContent('Test Alert 2');
    expect(alertRows[2]).toHaveTextContent('Test Alert 3');
  });

  it('Shold not display alert rules when the namespace name does not match the folder name', () => {
    // Arrange
    const store = configureStore();
    const folder = mockFolder();

    const grafanaNamespace: CombinedRuleNamespace = {
      name: 'Folder without alerts',
      rulesSource: GRAFANA_RULES_SOURCE_NAME,
      groups: [
        {
          name: 'default',
          rules: [
            mockCombinedRule({ name: 'Test Alert from other folder 1' }),
            mockCombinedRule({ name: 'Test Alert from other folder 2' }),
          ],
        },
      ],
    };

    combinedNamespaceMock.mockReturnValue([grafanaNamespace]);

    // Act
    render(
      <Provider store={store}>
        <MemoryRouter>
          <AlertsFolderView folder={folder} />
        </MemoryRouter>
      </Provider>
    );

    // Assert
    expect(ui.ruleList.row.queryAll()).toHaveLength(0);
  });

  it('Should filter alert rules by the name, case insensitive', () => {
    // Arrange
    const store = configureStore();
    const folder = mockFolder();

    const grafanaNamespace: CombinedRuleNamespace = {
      name: folder.title,
      rulesSource: GRAFANA_RULES_SOURCE_NAME,
      groups: [
        {
          name: 'default',
          rules: [mockCombinedRule({ name: 'CPU Alert' }), mockCombinedRule({ name: 'RAM usage alert' })],
        },
      ],
    };

    combinedNamespaceMock.mockReturnValue([grafanaNamespace]);

    // Act
    render(
      <Provider store={store}>
        <MemoryRouter>
          <AlertsFolderView folder={folder} />
        </MemoryRouter>
      </Provider>
    );

    userEvent.type(ui.filter.name.get(), 'cpu');

    // Assert
    expect(ui.ruleList.row.queryAll()).toHaveLength(1);
    expect(ui.ruleList.row.get()).toHaveTextContent('CPU Alert');
  });

  it('Should filter alert rule by labels', () => {
    // Arrange
    const store = configureStore();
    const folder = mockFolder();

    const grafanaNamespace: CombinedRuleNamespace = {
      name: folder.title,
      rulesSource: GRAFANA_RULES_SOURCE_NAME,
      groups: [
        {
          name: 'default',
          rules: [
            mockCombinedRule({ name: 'CPU Alert', labels: {} }),
            mockCombinedRule({ name: 'RAM usage alert', labels: { severity: 'critical' } }),
          ],
        },
      ],
    };

    combinedNamespaceMock.mockReturnValue([grafanaNamespace]);

    // Act
    render(
      <Provider store={store}>
        <MemoryRouter>
          <AlertsFolderView folder={folder} />
        </MemoryRouter>
      </Provider>
    );

    userEvent.type(ui.filter.label.get(), 'severity=critical');

    // Assert
    expect(ui.ruleList.row.queryAll()).toHaveLength(1);
    expect(ui.ruleList.row.get()).toHaveTextContent('RAM usage alert');
  });
});
