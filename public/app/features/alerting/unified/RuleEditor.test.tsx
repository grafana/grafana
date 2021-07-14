import { Matcher, render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { locationService, setDataSourceSrv, setBackendSrv, BackendSrv } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import RuleEditor from './RuleEditor';
import { Router, Route } from 'react-router-dom';
import React from 'react';
import { byLabelText, byRole, byTestId, byText } from 'testing-library-selector';
import { selectOptionInTest } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { mockDataSource, MockDataSourceSrv } from './mocks';
import userEvent from '@testing-library/user-event';
import { DataSourceInstanceSettings } from '@grafana/data';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { getAllDataSources } from './utils/config';
import { fetchRulerRules, fetchRulerRulesGroup, fetchRulerRulesNamespace, setRulerRuleGroup } from './api/ruler';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { DashboardSearchHit } from 'app/features/search/types';
import { getDefaultQueries } from './utils/rule-form';
import { ExpressionEditorProps } from './components/rule-editor/ExpressionEditor';

jest.mock('./components/rule-editor/ExpressionEditor', () => ({
  // eslint-disable-next-line react/display-name
  ExpressionEditor: ({ value, onChange }: ExpressionEditorProps) => (
    <input value={value} data-testid="expr" onChange={(e) => onChange(e.target.value)} />
  ),
}));

jest.mock('./api/ruler');
jest.mock('./utils/config');

// there's no angular scope in test and things go terribly wrong when trying to render the query editor row.
// lets just skip it
jest.mock('app/features/query/components/QueryEditorRow', () => ({
  // eslint-disable-next-line react/display-name
  QueryEditorRow: () => <p>hi</p>,
}));

const mocks = {
  getAllDataSources: typeAsJestMock(getAllDataSources),

  api: {
    fetchRulerRulesGroup: typeAsJestMock(fetchRulerRulesGroup),
    setRulerRuleGroup: typeAsJestMock(setRulerRuleGroup),
    fetchRulerRulesNamespace: typeAsJestMock(fetchRulerRulesNamespace),
    fetchRulerRules: typeAsJestMock(fetchRulerRules),
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
    name: byLabelText('Alert name'),
    alertType: byTestId('alert-type-picker'),
    dataSource: byTestId('datasource-picker'),
    folder: byTestId('folder-picker'),
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
  },
};

describe('RuleEditor', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    contextSrv.isEditor = true;
  });

  it('can create a new cloud alert', async () => {
    const dataSources = {
      default: mockDataSource(
        {
          type: 'prometheus',
          name: 'Prom',
          isDefault: true,
        },
        { alerting: true }
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
      namespace1: [
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

    await renderRuleEditor();
    await userEvent.type(await ui.inputs.name.find(), 'my great new rule');
    await clickSelectOption(ui.inputs.alertType.get(), /Cortex\/Loki managed alert/);
    const dataSourceSelect = ui.inputs.dataSource.get();
    userEvent.click(byRole('textbox').get(dataSourceSelect));
    await clickSelectOption(dataSourceSelect, 'Prom (default)');
    await waitFor(() => expect(mocks.api.fetchRulerRules).toHaveBeenCalled());
    await clickSelectOption(ui.inputs.namespace.get(), 'namespace2');
    await clickSelectOption(ui.inputs.group.get(), 'group2');

    await userEvent.type(ui.inputs.expr.get(), 'up == 1');

    await userEvent.type(ui.inputs.annotationValue(0).get(), 'some summary');
    await userEvent.type(ui.inputs.annotationValue(1).get(), 'some description');

    userEvent.click(ui.buttons.addLabel.get());

    await userEvent.type(ui.inputs.labelKey(0).get(), 'severity');
    await userEvent.type(ui.inputs.labelValue(0).get(), 'warn');
    await userEvent.type(ui.inputs.labelKey(1).get(), 'team');
    await userEvent.type(ui.inputs.labelValue(1).get(), 'the a-team');

    // save and check what was sent to backend
    userEvent.click(ui.buttons.save.get());
    await waitFor(() => expect(mocks.api.setRulerRuleGroup).toHaveBeenCalled());
    expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledWith('Prom', 'namespace2', {
      name: 'group2',
      rules: [
        {
          alert: 'my great new rule',
          annotations: { description: 'some description', summary: 'some summary' },
          labels: { severity: 'warn', team: 'the a-team' },
          expr: 'up == 1',
          for: '1m',
        },
      ],
    });
  });

  it('can create new grafana managed alert', async () => {
    const searchFolderMock = jest.fn().mockResolvedValue([
      {
        title: 'Folder A',
        id: 1,
      },
      {
        title: 'Folder B',
        id: 2,
      },
    ] as DashboardSearchHit[]);

    const dataSources = {
      default: mockDataSource({
        type: 'prometheus',
        name: 'Prom',
        isDefault: true,
      }),
    };

    const backendSrv = ({
      search: searchFolderMock,
    } as any) as BackendSrv;
    setBackendSrv(backendSrv);
    setDataSourceSrv(new MockDataSourceSrv(dataSources));
    mocks.api.setRulerRuleGroup.mockResolvedValue();
    mocks.api.fetchRulerRulesNamespace.mockResolvedValue([]);

    // fill out the form
    await renderRuleEditor();
    userEvent.type(await ui.inputs.name.find(), 'my great new rule');
    await clickSelectOption(ui.inputs.alertType.get(), /Classic Grafana alerts based on thresholds/);
    const folderInput = await ui.inputs.folder.find();
    await waitFor(() => expect(searchFolderMock).toHaveBeenCalled());
    await clickSelectOption(folderInput, 'Folder A');

    await userEvent.type(ui.inputs.annotationValue(0).get(), 'some summary');
    await userEvent.type(ui.inputs.annotationValue(1).get(), 'some description');

    userEvent.click(ui.buttons.addLabel.get());

    await userEvent.type(ui.inputs.labelKey(0).get(), 'severity');
    await userEvent.type(ui.inputs.labelValue(0).get(), 'warn');
    await userEvent.type(ui.inputs.labelKey(1).get(), 'team');
    await userEvent.type(ui.inputs.labelValue(1).get(), 'the a-team');

    // save and check what was sent to backend
    userEvent.click(ui.buttons.save.get());
    await waitFor(() => expect(mocks.api.setRulerRuleGroup).toHaveBeenCalled());
    expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledWith(GRAFANA_RULES_SOURCE_NAME, 'Folder A', {
      interval: '1m',
      name: 'my great new rule',
      rules: [
        {
          annotations: { description: 'some description', summary: 'some summary' },
          labels: { severity: 'warn', team: 'the a-team' },
          for: '5m',
          grafana_alert: {
            condition: 'B',
            data: getDefaultQueries(),
            exec_err_state: 'Alerting',
            no_data_state: 'NoData',
            title: 'my great new rule',
          },
        },
      ],
    });
  });

  it('for cloud alerts, should only allow to select editable rules sources', async () => {
    const dataSources: Record<string, DataSourceInstanceSettings<any>> = {
      // can edit rules
      loki: mockDataSource(
        {
          type: DataSourceType.Loki,
          name: 'loki with ruler',
        },
        { alerting: true }
      ),
      loki_disabled: mockDataSource(
        {
          type: DataSourceType.Loki,
          name: 'loki disabled for alerting',
          jsonData: {
            manageAlerts: false,
          },
        },
        { alerting: true }
      ),
      // can edit rules
      prom: mockDataSource(
        {
          type: DataSourceType.Prometheus,
          name: 'cortex with ruler',
        },
        { alerting: true }
      ),
      // cannot edit rules
      loki_local_rule_store: mockDataSource(
        {
          type: DataSourceType.Loki,
          name: 'loki with local rule store',
        },
        { alerting: true }
      ),
      // cannot edit rules
      prom_no_ruler_api: mockDataSource(
        {
          type: DataSourceType.Loki,
          name: 'cortex without ruler api',
        },
        { alerting: true }
      ),
      // not a supported datasource type
      splunk: mockDataSource(
        {
          type: 'splunk',
          name: 'splunk',
        },
        { alerting: true }
      ),
    };

    mocks.api.fetchRulerRulesGroup.mockImplementation(async (dataSourceName: string) => {
      if (dataSourceName === 'loki with ruler' || dataSourceName === 'cortex with ruler') {
        return null;
      }
      if (dataSourceName === 'loki with local rule store') {
        throw {
          status: 400,
          data: {
            message: 'GetRuleGroup unsupported in rule local store',
          },
        };
      }
      if (dataSourceName === 'cortex without ruler api') {
        throw new Error('404 from rules config endpoint. Perhaps ruler API is not enabled?');
      }
      return null;
    });

    setDataSourceSrv(new MockDataSourceSrv(dataSources));
    mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));

    // render rule editor, select cortex/loki managed alerts
    await renderRuleEditor();
    await ui.inputs.name.find();
    await clickSelectOption(ui.inputs.alertType.get(), /Cortex\/Loki managed alert/);

    // wait for ui theck each datasource if it supports rule editing
    await waitFor(() => expect(mocks.api.fetchRulerRulesGroup).toHaveBeenCalledTimes(4));

    // check that only rules sources that have ruler available are there
    const dataSourceSelect = ui.inputs.dataSource.get();
    userEvent.click(byRole('textbox').get(dataSourceSelect));
    expect(await byText('loki with ruler').query()).toBeInTheDocument();
    expect(byText('cortex with ruler').query()).toBeInTheDocument();
    expect(byText('loki with local rule store').query()).not.toBeInTheDocument();
    expect(byText('prom without ruler api').query()).not.toBeInTheDocument();
    expect(byText('splunk').query()).not.toBeInTheDocument();
    expect(byText('loki disabled for alerting').query()).not.toBeInTheDocument();
  });
});

const clickSelectOption = async (selectElement: HTMLElement, optionText: Matcher): Promise<void> => {
  userEvent.click(byRole('textbox').get(selectElement));
  await selectOptionInTest(selectElement, optionText as string);
};
