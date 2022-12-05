import { render, waitFor, screen, within, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { Route, Router } from 'react-router-dom';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { selectors } from '@grafana/e2e-selectors';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { PromApplication } from 'app/types/unified-alerting-dto';

import { searchFolders } from '../../manage-dashboards/state/actions';

import RuleEditor from './RuleEditor';
import { discoverFeatures } from './api/buildInfo';
import { fetchRulerRules, fetchRulerRulesGroup, fetchRulerRulesNamespace, setRulerRuleGroup } from './api/ruler';
import { ExpressionEditorProps } from './components/rule-editor/ExpressionEditor';
import { disableRBAC, mockDataSource, MockDataSourceSrv } from './mocks';
import { fetchRulerRulesIfNotFetchedYet } from './state/actions';
import * as config from './utils/config';
import { DataSourceType } from './utils/datasource';

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

describe('RuleEditor cloud', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contextSrv.isEditor = true;
    contextSrv.hasEditPermissionInFolders = true;
  });

  disableRBAC();

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
    mocks.searchFolders.mockResolvedValue([]);

    mocks.api.discoverFeatures.mockResolvedValue({
      application: PromApplication.Cortex,
      features: {
        rulerApiEnabled: true,
      },
    });

    renderRuleEditor();
    await waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));

    await userEvent.click(await ui.buttons.lotexAlert.find());

    const dataSourceSelect = ui.inputs.dataSource.get();
    await userEvent.click(byRole('combobox').get(dataSourceSelect));
    await clickSelectOption(dataSourceSelect, 'Prom (default)');
    await waitFor(() => expect(mocks.api.fetchRulerRules).toHaveBeenCalled());

    await userEvent.type(await ui.inputs.expr.find(), 'up == 1');

    await userEvent.type(ui.inputs.name.get(), 'my great new rule');
    await clickSelectOption(ui.inputs.namespace.get(), 'namespace2');
    await clickSelectOption(ui.inputs.group.get(), 'group2');

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
      { dataSourceName: 'Prom', apiVersion: 'legacy' },
      'namespace2',
      {
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
      }
    );
  });

  it('can create a new cloud recording rule', async () => {
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
    mocks.searchFolders.mockResolvedValue([]);

    mocks.api.discoverFeatures.mockResolvedValue({
      application: PromApplication.Cortex,
      features: {
        rulerApiEnabled: true,
      },
    });

    renderRuleEditor();
    await waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));
    await userEvent.type(await ui.inputs.name.find(), 'my great new recording rule');
    await userEvent.click(await ui.buttons.lotexRecordingRule.get());

    const dataSourceSelect = ui.inputs.dataSource.get();
    await userEvent.click(byRole('combobox').get(dataSourceSelect));

    await clickSelectOption(dataSourceSelect, 'Prom (default)');
    await waitFor(() => expect(mocks.api.fetchRulerRules).toHaveBeenCalled());
    await clickSelectOption(ui.inputs.namespace.get(), 'namespace2');
    await clickSelectOption(ui.inputs.group.get(), 'group2');

    await userEvent.type(await ui.inputs.expr.find(), 'up == 1');

    // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
    await userEvent.click(ui.buttons.addLabel.get(), { pointerEventsCheck: PointerEventsCheckLevel.Never });

    await userEvent.type(getLabelInput(ui.inputs.labelKey(1).get()), 'team{enter}');
    await userEvent.type(getLabelInput(ui.inputs.labelValue(1).get()), 'the a-team{enter}');

    // try to save, find out that recording rule name is invalid
    await userEvent.click(ui.buttons.save.get());
    await waitFor(() =>
      expect(
        byText(
          'Recording rule name must be valid metric name. It may only contain letters, numbers, and colons. It may not contain whitespace.'
        ).get()
      ).toBeInTheDocument()
    );
    expect(mocks.api.setRulerRuleGroup).not.toBeCalled();

    // fix name and re-submit
    await userEvent.clear(await ui.inputs.name.find());
    await userEvent.type(await ui.inputs.name.find(), 'my:great:new:recording:rule');

    // save and check what was sent to backend
    await userEvent.click(ui.buttons.save.get());
    await waitFor(() => expect(mocks.api.setRulerRuleGroup).toHaveBeenCalled());
    expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledWith(
      { dataSourceName: 'Prom', apiVersion: 'legacy' },
      'namespace2',
      {
        name: 'group2',
        rules: [
          {
            record: 'my:great:new:recording:rule',
            labels: { team: 'the a-team' },
            expr: 'up == 1',
          },
        ],
      }
    );
  });

  it('for cloud alerts, should only allow to select editable rules sources', async () => {
    const dataSources = {
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

    mocks.api.discoverFeatures.mockImplementation(async (dataSourceName) => {
      if (dataSourceName === 'loki with ruler' || dataSourceName === 'cortex with ruler') {
        return {
          application: PromApplication.Cortex,
          features: {
            rulerApiEnabled: true,
            alertManagerConfigApi: false,
            federatedRules: false,
            querySharding: false,
          },
        };
      }
      if (dataSourceName === 'loki with local rule store') {
        return {
          application: PromApplication.Cortex,
          features: {
            rulerApiEnabled: false,
            alertManagerConfigApi: false,
            federatedRules: false,
            querySharding: false,
          },
        };
      }
      if (dataSourceName === 'cortex without ruler api') {
        return {
          application: PromApplication.Cortex,
          features: {
            rulerApiEnabled: false,
            alertManagerConfigApi: false,
            federatedRules: false,
            querySharding: false,
          },
        };
      }

      throw new Error(`${dataSourceName} not handled`);
    });

    mocks.api.fetchRulerRulesGroup.mockImplementation(async ({ dataSourceName }) => {
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
    mocks.searchFolders.mockResolvedValue([]);

    // render rule editor, select mimir/loki managed alerts
    renderRuleEditor();
    await waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));

    await ui.inputs.name.find();
    await userEvent.click(await ui.buttons.lotexAlert.get());

    // check that only rules sources that have ruler available are there
    const dataSourceSelect = ui.inputs.dataSource.get();
    await userEvent.click(byRole('combobox').get(dataSourceSelect));
    expect(await byText('loki with ruler').query()).toBeInTheDocument();
    expect(byText('cortex with ruler').query()).toBeInTheDocument();
    expect(byText('loki with local rule store').query()).not.toBeInTheDocument();
    expect(byText('prom without ruler api').query()).not.toBeInTheDocument();
    expect(byText('splunk').query()).not.toBeInTheDocument();
    expect(byText('loki disabled for alerting').query()).not.toBeInTheDocument();
  });
});
