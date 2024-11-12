import { screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { byRole } from 'testing-library-selector';

import { contextSrv } from 'app/core/services/context_srv';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { DashboardSearchHit, DashboardSearchItemType } from 'app/features/search/types';
import { AccessControlAction } from 'app/types';

import { searchFolders } from '../../../../app/features/manage-dashboards/state/actions';

import { ExpressionEditorProps } from './components/rule-editor/ExpressionEditor';
import { grantUserPermissions, mockDataSource } from './mocks';
import { grafanaRulerGroup, grafanaRulerRule } from './mocks/grafanaRulerApi';
import { setupDataSources } from './testSetup/datasources';
import * as config from './utils/config';

jest.mock('./components/rule-editor/ExpressionEditor', () => ({
  ExpressionEditor: ({ value, onChange }: ExpressionEditorProps) => (
    <input value={value} data-testid="expr" onChange={(e) => onChange(e.target.value)} />
  ),
}));

jest.mock('../../../../app/features/manage-dashboards/state/actions');

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

// there's no angular scope in test and things go terribly wrong when trying to render the query editor row.
// lets just skip it
jest.mock('app/features/query/components/QueryEditorRow', () => ({
  QueryEditorRow: () => <p>hi</p>,
}));

jest.spyOn(config, 'getAllDataSources');

jest.setTimeout(60 * 1000);

const mocks = {
  getAllDataSources: jest.mocked(config.getAllDataSources),
  searchFolders: jest.mocked(searchFolders),
};

setupMswServer();

describe('RuleEditor grafana managed rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contextSrv.isEditor = true;
    contextSrv.hasEditPermissionInFolders = true;
    grantUserPermissions([
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingRuleUpdate,
      AccessControlAction.AlertingRuleDelete,
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.DataSourcesRead,
      AccessControlAction.DataSourcesWrite,
      AccessControlAction.DataSourcesCreate,
      AccessControlAction.FoldersWrite,
      AccessControlAction.FoldersRead,
      AccessControlAction.AlertingRuleExternalRead,
      AccessControlAction.AlertingRuleExternalWrite,
    ]);
  });

  it('can create new grafana managed alert', async () => {
    const dataSources = {
      default: mockDataSource(
        {
          type: 'prometheus',
          name: 'Prom',
          isDefault: true,
        },
        { alerting: false }
      ),
    };

    setupDataSources(dataSources.default);
    mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
    mocks.searchFolders.mockResolvedValue([
      {
        title: 'Folder A',
        uid: grafanaRulerRule.grafana_alert.namespace_uid,
        id: 1,
        type: DashboardSearchItemType.DashDB,
      },
      {
        title: 'Folder B',
        id: 2,
        uid: 'b',
        type: DashboardSearchItemType.DashDB,
      },
      {
        title: 'Folder / with slash',
        uid: 'c',
        id: 2,
        type: DashboardSearchItemType.DashDB,
      },
    ] as DashboardSearchHit[]);

    renderRuleEditor();
    await waitForElementToBeRemoved(screen.queryAllByTestId('Spinner'));

    await userEvent.type(await ui.inputs.name.find(), 'my great new rule');

    const folderInput = await ui.inputs.folder.find();
    await clickSelectOption(folderInput, 'Folder A');
    const groupInput = await ui.inputs.group.find();
    await userEvent.click(await byRole('combobox').find(groupInput));
    await clickSelectOption(groupInput, grafanaRulerGroup.name);
    await userEvent.type(ui.inputs.annotationValue(1).get(), 'some description');

    await userEvent.click(ui.buttons.saveAndExit.get());

    expect(await screen.findByRole('status')).toHaveTextContent('Rule added successfully');
  });
});
