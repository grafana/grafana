import { render, waitFor, screen, within, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { Route, Router } from 'react-router-dom';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { byRole, byTestId } from 'testing-library-selector';

import { selectors } from '@grafana/e2e-selectors';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { ADD_NEW_FOLER_OPTION } from 'app/core/components/Select/FolderPicker';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardSearchHit } from 'app/features/search/types';
import { configureStore } from 'app/store/configureStore';
import { GrafanaAlertStateDecision, PromApplication } from 'app/types/unified-alerting-dto';

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
  const store = configureStore();

  locationService.push(identifier ? `/alerting/${identifier}/edit` : `/alerting/new`);

  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <Route path={['/alerting/new', '/alerting/:id/edit']} component={RuleEditor} />
      </Router>
    </Provider>
  );
}

const ui = {
  inputs: {
    name: byRole('textbox', { name: /rule name name for the alert rule\./i }),
    alertType: byTestId('alert-type-picker'),
    dataSource: byTestId('datasource-picker'),
    folder: byTestId('folder-picker'),
    folderContainer: byTestId(selectors.components.FolderPicker.containerV2),
    namespace: byTestId('namespace-picker'),
    group: byTestId('group-picker'),
    annotationKey: (idx: number) => byTestId(`annotation-key-${idx}`),
    annotationValue: (idx: number) => byTestId(`annotation-value-${idx}`),
    labelKey: (idx: number) => byTestId(`label-key-${idx}`),
    labelValue: (idx: number) => byTestId(`label-value-${idx}`),
    expr: byTestId('expr'),
  },
  buttons: {
    save: byRole('button', { name: 'Save' }),
    addAnnotation: byRole('button', { name: /Add info/ }),
    addLabel: byRole('button', { name: /Add label/ }),
    // alert type buttons
    grafanaManagedAlert: byRole('button', { name: /Grafana managed/ }),
    lotexAlert: byRole('button', { name: /Mimir or Loki alert/ }),
    lotexRecordingRule: byRole('button', { name: /Mimir or Loki recording rule/ }),
  },
};

const getLabelInput = (selector: HTMLElement) => within(selector).getByRole('combobox');

describe('RuleEditor grafana managed rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contextSrv.isEditor = true;
    contextSrv.hasEditPermissionInFolders = true;
  });

  disableRBAC();

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
          name: 'group1',
          rules: [],
        },
      ],
      namespace2: [
        {
          name: 'group2',
          rules: [],
        },
      ],
    });
    mocks.searchFolders.mockResolvedValue([
      {
        title: 'Folder A',
        id: 1,
      },
      {
        title: 'Folder B',
        id: 2,
      },
      {
        title: 'Folder / with slash',
        id: 2,
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
    await clickSelectOption(groupInput, 'group1 (1m)');

    await userEvent.type(ui.inputs.annotationValue(0).get(), 'some summary');
    await userEvent.type(ui.inputs.annotationValue(1).get(), 'some description');

    // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
    await userEvent.click(ui.buttons.addLabel.get(), { pointerEventsCheck: PointerEventsCheckLevel.Never });

    await userEvent.type(getLabelInput(ui.inputs.labelKey(0).get()), 'severity{enter}');
    await userEvent.type(getLabelInput(ui.inputs.labelValue(0).get()), 'warn{enter}');
    await userEvent.type(getLabelInput(ui.inputs.labelKey(1).get()), 'team{enter}');
    await userEvent.type(getLabelInput(ui.inputs.labelValue(1).get()), 'the a-team{enter}');

    // save and check what was sent to backend
    await userEvent.click(ui.buttons.save.get());
    await waitFor(() => expect(mocks.api.setRulerRuleGroup).toHaveBeenCalled());
    expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledWith(
      { dataSourceName: GRAFANA_RULES_SOURCE_NAME, apiVersion: 'legacy' },
      'Folder A',
      {
        interval: '1m',
        name: 'group1',
        rules: [
          {
            annotations: { description: 'some description', summary: 'some summary' },
            labels: { severity: 'warn', team: 'the a-team' },
            for: '5m',
            grafana_alert: {
              condition: 'B',
              data: getDefaultQueries(),
              exec_err_state: GrafanaAlertStateDecision.Error,
              no_data_state: 'NoData',
              title: 'my great new rule',
            },
          },
        ],
      }
    );
  });

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
    expect(ui.inputs.annotationValue(0).get()).toHaveValue('some description');
    expect(ui.inputs.annotationValue(1).get()).toHaveValue('some summary');

    //check that slashed folders are not in the list
    expect(ui.inputs.folder.get()).toHaveTextContent(new RegExp(folder.title));
    expect(ui.inputs.folder.get()).not.toHaveTextContent(new RegExp(slashedFolder.title));

    //check that slashes warning is only shown once user search slashes
    const folderInput = await ui.inputs.folderContainer.find();
    expect(within(folderInput).queryByText("Folders with '/' character are not allowed.")).not.toBeInTheDocument();
    await userEvent.type(within(folderInput).getByRole('combobox'), 'new slashed //');
    expect(within(folderInput).getByText("Folders with '/' character are not allowed.")).toBeInTheDocument();
    await userEvent.keyboard('{backspace} {backspace}{backspace}');
    expect(within(folderInput).queryByText("Folders with '/' character are not allowed.")).not.toBeInTheDocument();

    // add an annotation
    await clickSelectOption(ui.inputs.annotationKey(2).get(), /Add new/);
    await userEvent.type(byRole('textbox').get(ui.inputs.annotationKey(2).get()), 'custom');
    await userEvent.type(ui.inputs.annotationValue(2).get(), 'value');

    //add a label
    await userEvent.type(getLabelInput(ui.inputs.labelKey(2).get()), 'custom{enter}');
    await userEvent.type(getLabelInput(ui.inputs.labelValue(2).get()), 'value{enter}');

    // save and check what was sent to backend
    await userEvent.click(ui.buttons.save.get());
    await waitFor(() => expect(mocks.api.setRulerRuleGroup).toHaveBeenCalled());

    //check that '+ Add new' option is in folders drop down even if we don't have values
    const emptyFolderInput = await ui.inputs.folderContainer.find();
    mocks.searchFolders.mockResolvedValue([] as DashboardSearchHit[]);
    await renderRuleEditor(uid);
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
              no_data_state: 'NoData',
              title: 'my great new rule',
            },
          },
        ],
      }
    );
  });
});
