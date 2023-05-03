import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { byTestId } from 'testing-library-selector';

import { FolderState } from 'app/types';
import { CombinedRuleNamespace } from 'app/types/unified-alerting';

import { AlertsFolderView } from './AlertsFolderView';
import { mockCombinedRule } from './mocks';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

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
    canDelete: false,
    ...folderOverride,
  };
};

describe('AlertsFolderView tests', () => {
  it('Should display grafana alert rules when the namespace name matches the folder name', () => {
    // Arrange
    const folder = mockFolder();

    const grafanaNamespace: CombinedRuleNamespace = {
      name: folder.title,
      rulesSource: GRAFANA_RULES_SOURCE_NAME,
      groups: [
        {
          name: 'group1',
          rules: [
            mockCombinedRule({ name: 'Test Alert 1' }),
            mockCombinedRule({ name: 'Test Alert 2' }),
            mockCombinedRule({ name: 'Test Alert 3' }),
          ],
          totals: {},
        },
        {
          name: 'group2',
          rules: [
            mockCombinedRule({ name: 'Test Alert 4' }),
            mockCombinedRule({ name: 'Test Alert 5' }),
            mockCombinedRule({ name: 'Test Alert 6' }),
          ],
          totals: {},
        },
      ],
    };

    combinedNamespaceMock.mockReturnValue([grafanaNamespace]);

    // Act
    render(
      <TestProvider>
        <AlertsFolderView folder={folder} />
      </TestProvider>
    );

    // Assert
    const alertRows = ui.ruleList.row.queryAll();
    expect(alertRows).toHaveLength(6);
    expect(alertRows[0]).toHaveTextContent('Test Alert 1');
    expect(alertRows[1]).toHaveTextContent('Test Alert 2');
    expect(alertRows[2]).toHaveTextContent('Test Alert 3');
    expect(alertRows[3]).toHaveTextContent('Test Alert 4');
    expect(alertRows[4]).toHaveTextContent('Test Alert 5');
    expect(alertRows[5]).toHaveTextContent('Test Alert 6');
  });

  it('Should not display alert rules when the namespace name does not match the folder name', () => {
    // Arrange
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
          totals: {},
        },
      ],
    };

    combinedNamespaceMock.mockReturnValue([grafanaNamespace]);

    // Act
    render(
      <TestProvider>
        <AlertsFolderView folder={folder} />
      </TestProvider>
    );

    // Assert
    expect(ui.ruleList.row.queryAll()).toHaveLength(0);
  });

  it('Should filter alert rules by the name, case insensitive', async () => {
    // Arrange
    const folder = mockFolder();

    const grafanaNamespace: CombinedRuleNamespace = {
      name: folder.title,
      rulesSource: GRAFANA_RULES_SOURCE_NAME,
      groups: [
        {
          name: 'default',
          rules: [mockCombinedRule({ name: 'CPU Alert' }), mockCombinedRule({ name: 'RAM usage alert' })],
          totals: {},
        },
      ],
    };

    combinedNamespaceMock.mockReturnValue([grafanaNamespace]);

    // Act
    render(
      <TestProvider>
        <AlertsFolderView folder={folder} />
      </TestProvider>
    );

    await userEvent.type(ui.filter.name.get(), 'cpu');

    // Assert
    expect(ui.ruleList.row.queryAll()).toHaveLength(1);
    expect(ui.ruleList.row.get()).toHaveTextContent('CPU Alert');
  });

  it('Should filter alert rule by labels', async () => {
    // Arrange
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
          totals: {},
        },
      ],
    };

    combinedNamespaceMock.mockReturnValue([grafanaNamespace]);

    // Act
    render(
      <TestProvider>
        <AlertsFolderView folder={folder} />
      </TestProvider>
    );

    await userEvent.type(ui.filter.label.get(), 'severity=critical');

    // Assert
    expect(ui.ruleList.row.queryAll()).toHaveLength(1);
    expect(ui.ruleList.row.get()).toHaveTextContent('RAM usage alert');
  });
});
