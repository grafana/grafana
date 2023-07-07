import { render, waitFor, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Route } from 'react-router-dom';
import { TestProvider } from 'test/helpers/TestProvider';
import { ui } from 'test/helpers/alertingRuleEditor';

import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { ADD_NEW_FOLER_OPTION } from 'app/core/components/Select/FolderPicker';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardSearchHit } from 'app/features/search/types';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

import { searchFolders } from '../../../../app/features/manage-dashboards/state/actions';
import { backendSrv } from '../../../core/services/backend_srv';
import { AccessControlAction } from '../../../types';

import RuleEditor from './RuleEditor';
import { discoverFeatures } from './api/buildInfo';
import { fetchRulerRules, fetchRulerRulesGroup, fetchRulerRulesNamespace, setRulerRuleGroup } from './api/ruler';
import { ExpressionEditorProps } from './components/rule-editor/ExpressionEditor';
import { disableRBAC, mockDataSource, MockDataSourceSrv, mockFolder } from './mocks';
import { fetchRulerRulesIfNotFetchedYet } from './state/actions';
import * as config from './utils/config';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { getDefaultQueries } from './utils/rule-form';

jest.mock('./components/rule-editor/ExpressionEditor', () => ({
  // eslint-disable-next-line react/display-name
  ExpressionEditor: ({ value, onChange }: ExpressionEditorProps) => (
    <input value={value} data-testid="expr" onChange={(e) => onChange(e.target.value)} />
  ),
}));

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

jest.mock('./api/buildInfo');
jest.mock('./api/ruler');
jest.mock('../../../../app/features/manage-dashboards/state/actions');

// there's no angular scope in test and things go terribly wrong when trying to render the query editor row.
// lets just skip it
jest.mock('app/features/query/components/QueryEditorRow', () => ({
  // eslint-disable-next-line react/display-name
  QueryEditorRow: () => <p>hi</p>,
}));

jest.spyOn(config, 'getAllDataSources');

jest.setTimeout(60 * 1000);

const mocks = {
  getAllDataSources: jest.mocked(config.getAllDataSources),
  searchFolders: jest.mocked(searchFolders),
  api: {
    discoverFeatures: jest.mocked(discoverFeatures),
    fetchRulerRulesGroup: jest.mocked(fetchRulerRulesGroup),
    setRulerRuleGroup: jest.mocked(setRulerRuleGroup),
    fetchRulerRulesNamespace: jest.mocked(fetchRulerRulesNamespace),
    fetchRulerRules: jest.mocked(fetchRulerRules),
    fetchRulerRulesIfNotFetchedYet: jest.mocked(fetchRulerRulesIfNotFetchedYet),
  },
};

function renderRuleEditor(identifier?: string) {
  locationService.push(identifier ? `/alerting/${identifier}/edit` : `/alerting/new`);

  return render(
    <TestProvider>
      <Route path={['/alerting/new', '/alerting/:id/edit']} component={RuleEditor} />
    </TestProvider>
  );
}

const getLabelInput = (selector: HTMLElement) => within(selector).getByRole('combobox');
describe('RuleEditor grafana managed rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contextSrv.isEditor = true;
    contextSrv.hasEditPermissionInFolders = true;
  });

  disableRBAC();

  it('can edit grafana managed rule', async () => {
    const uid = 'FOOBAR123';
    const folder = {
      title: 'Folder A',
      uid: 'abcd',
      id: 1,
    };

    const slashedFolder = {
      title: 'Folder with /',
      uid: 'abcde',
      id: 2,
    };

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

    jest.spyOn(backendSrv, 'getFolderByUid').mockResolvedValue({
      ...mockFolder(),
      accessControl: {
        [AccessControlAction.AlertingRuleUpdate]: true,
      },
    });

    setDataSourceSrv(new MockDataSourceSrv(dataSources));

    mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
    mocks.api.setRulerRuleGroup.mockResolvedValue();
    mocks.api.fetchRulerRulesNamespace.mockResolvedValue([]);
    mocks.api.fetchRulerRules.mockResolvedValue({
      [folder.title]: [
        {
          interval: '1m',
          name: 'my great new rule',
          rules: [
            {
              annotations: { description: 'some description', summary: 'some summary' },
              labels: { severity: 'warn', team: 'the a-team' },
              for: '5m',
              grafana_alert: {
                uid,
                namespace_uid: 'abcd',
                namespace_id: 1,
                condition: 'B',
                data: getDefaultQueries(),
                exec_err_state: GrafanaAlertStateDecision.Error,
                no_data_state: GrafanaAlertStateDecision.NoData,
                title: 'my great new rule',
              },
            },
          ],
        },
      ],
    });
    mocks.searchFolders.mockResolvedValue([folder, slashedFolder] as DashboardSearchHit[]);

    renderRuleEditor(uid);

    // check that it's filled in
    const nameInput = await ui.inputs.name.find();
    expect(nameInput).toHaveValue('my great new rule');
    //check that folder is in the list
    expect(ui.inputs.folder.get()).toHaveTextContent(new RegExp(folder.title));
    expect(ui.inputs.annotationValue(0).get()).toHaveValue('some summary');
    expect(ui.inputs.annotationValue(1).get()).toHaveValue('some description');

    //check that slashed folders are not in the list
    expect(ui.inputs.folder.get()).toHaveTextContent(new RegExp(folder.title));
    expect(ui.inputs.folder.get()).not.toHaveTextContent(new RegExp(slashedFolder.title));

    //check that slashes warning is only shown once user search slashes
    //todo: move this test to a unit test in FolderAndGroup unit test
    // const folderInput = await ui.inputs.folderContainer.find();
    // expect(within(folderInput).queryByText("Folders with '/' character are not allowed.")).not.toBeInTheDocument();
    // await userEvent.type(within(folderInput).getByRole('combobox'), 'new slashed //');
    // expect(within(folderInput).getByText("Folders with '/' character are not allowed.")).toBeInTheDocument();
    // await userEvent.keyboard('{backspace} {backspace}{backspace}');
    // expect(within(folderInput).queryByText("Folders with '/' character are not allowed.")).not.toBeInTheDocument();

    // add an annotation
    await userEvent.click(screen.getByText('Add custom annotation'));
    await userEvent.type(screen.getByPlaceholderText('Enter custom annotation name...'), 'custom');
    await userEvent.type(screen.getByPlaceholderText('Enter custom annotation content...'), 'value');

    //add a label
    await userEvent.type(getLabelInput(ui.inputs.labelKey(2).get()), 'custom{enter}');
    await userEvent.type(getLabelInput(ui.inputs.labelValue(2).get()), 'value{enter}');

    // save and check what was sent to backend
    await userEvent.click(ui.buttons.save.get());
    await waitFor(() => expect(mocks.api.setRulerRuleGroup).toHaveBeenCalled());

    //check that '+ Add new' option is in folders drop down even if we don't have values
    const emptyFolderInput = await ui.inputs.folderContainer.find();
    mocks.searchFolders.mockResolvedValue([] as DashboardSearchHit[]);
    await act(async () => {
      renderRuleEditor(uid);
    });
    await userEvent.click(within(emptyFolderInput).getByRole('combobox'));
    expect(screen.getByText(ADD_NEW_FOLER_OPTION)).toBeInTheDocument();

    expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledWith(
      { dataSourceName: GRAFANA_RULES_SOURCE_NAME, apiVersion: 'legacy' },
      'Folder A',
      {
        interval: '1m',
        name: 'my great new rule',
        rules: [
          {
            annotations: { description: 'some description', summary: 'some summary', custom: 'value' },
            labels: { severity: 'warn', team: 'the a-team', custom: 'value' },
            for: '5m',
            grafana_alert: {
              uid,
              condition: 'B',
              data: getDefaultQueries(),
              exec_err_state: GrafanaAlertStateDecision.Error,
              is_paused: false,
              no_data_state: 'NoData',
              title: 'my great new rule',
            },
          },
        ],
      }
    );
  });
});
