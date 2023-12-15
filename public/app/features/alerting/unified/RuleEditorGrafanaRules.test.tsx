import { screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import React from 'react';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { byRole } from 'testing-library-selector';

import { setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardSearchHit, DashboardSearchItemType } from 'app/features/search/types';
import { AccessControlAction } from 'app/types';
import { GrafanaAlertStateDecision, PromApplication } from 'app/types/unified-alerting-dto';

import { searchFolders } from '../../../../app/features/manage-dashboards/state/actions';

import { discoverFeatures } from './api/buildInfo';
import { fetchRulerRules, fetchRulerRulesGroup, fetchRulerRulesNamespace, setRulerRuleGroup } from './api/ruler';
import { ExpressionEditorProps } from './components/rule-editor/ExpressionEditor';
import { MockDataSourceSrv, grantUserPermissions, mockDataSource } from './mocks';
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

jest.mock('./api/buildInfo');
jest.mock('./api/ruler');
jest.mock('../../../../app/features/manage-dashboards/state/actions');

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

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

const getLabelInput = (selector: HTMLElement) => within(selector).getByRole('combobox');
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

    setDataSourceSrv(new MockDataSourceSrv(dataSources));
    mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
    mocks.api.setRulerRuleGroup.mockResolvedValue();
    mocks.api.fetchRulerRulesNamespace.mockResolvedValue([]);
    mocks.api.fetchRulerRulesGroup.mockResolvedValue({
      name: 'group2',
      rules: [],
    });
    mocks.api.fetchRulerRules.mockResolvedValue({
      'Folder A': [
        {
          interval: '1m',
          name: 'group1',
          rules: [
            {
              annotations: { description: 'some description', summary: 'some summary' },
              labels: { severity: 'warn', team: 'the a-team' },
              for: '5m',
              grafana_alert: {
                uid: '23',
                namespace_uid: 'abcd',
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
      namespace2: [
        {
          interval: '1m',
          name: 'group1',
          rules: [
            {
              annotations: { description: 'some description', summary: 'some summary' },
              labels: { severity: 'warn', team: 'the a-team' },
              for: '5m',
              grafana_alert: {
                uid: '23',
                namespace_uid: 'b',
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
    mocks.searchFolders.mockResolvedValue([
      {
        title: 'Folder A',
        uid: 'abcd',
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

    mocks.api.discoverFeatures.mockResolvedValue({
      application: PromApplication.Prometheus,
      features: {
        rulerApiEnabled: false,
      },
    });
    renderRuleEditor();
    await waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));

    await userEvent.type(await ui.inputs.name.find(), 'my great new rule');

    const folderInput = await ui.inputs.folder.find();
    await clickSelectOption(folderInput, 'Folder A');
    const groupInput = await ui.inputs.group.find();
    await userEvent.click(byRole('combobox').get(groupInput));
    await clickSelectOption(groupInput, 'group1');
    await userEvent.type(ui.inputs.annotationValue(1).get(), 'some description');

    // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
    await userEvent.click(ui.buttons.addLabel.get(), { pointerEventsCheck: PointerEventsCheckLevel.Never });

    await userEvent.type(getLabelInput(ui.inputs.labelKey(0).get()), 'severity{enter}');
    await userEvent.type(getLabelInput(ui.inputs.labelValue(0).get()), 'warn{enter}');
    //8 segons

    // save and check what was sent to backend
    await userEvent.click(ui.buttons.saveAndExit.get());
    // 9seg
    await waitFor(() => expect(mocks.api.setRulerRuleGroup).toHaveBeenCalled());
    // 9seg
    expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledWith(
      { dataSourceName: GRAFANA_RULES_SOURCE_NAME, apiVersion: 'legacy' },
      'abcd',
      {
        interval: '1m',
        name: 'group1',
        rules: [
          {
            annotations: { description: 'some description' },
            labels: { severity: 'warn' },
            for: '5m',
            grafana_alert: {
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
