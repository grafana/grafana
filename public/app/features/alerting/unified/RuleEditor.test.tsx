import { Matcher, render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import RuleEditor from './RuleEditor';
import { Router, Route } from 'react-router-dom';
import React from 'react';
import { byLabelText, byRole, byTestId, byText } from 'testing-library-selector';
import { contextSrv } from 'app/core/services/context_srv';
import { mockDataSource, MockDataSourceSrv } from './mocks';
import userEvent from '@testing-library/user-event';
import { DataSourceInstanceSettings } from '@grafana/data';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { getAllDataSources } from './utils/config';
import { fetchRulerRulesGroup } from './api/ruler';
import { DataSourceType } from './utils/datasource';

jest.mock('./api/ruler');
jest.mock('./utils/config');

const mocks = {
  getAllDataSources: typeAsJestMock(getAllDataSources),

  api: {
    fetchRulerRulesGroup: typeAsJestMock(fetchRulerRulesGroup),
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
  },
};

describe('RuleEditor', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    contextSrv.isEditor = true;
  });

  it('should only allow selecting editable Grafana folders', async () => {
    const dataSources: Record<string, DataSourceInstanceSettings<any>> = {
      // can edit rules
      loki: mockDataSource(
        {
          type: DataSourceType.Loki,
          name: 'loki with ruler',
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
    clickSelectOption(ui.inputs.alertType.get(), /Cortex\/Loki managed alert/);

    // wait for ui theck each datasource if it supports rule editing
    await waitFor(() => expect(mocks.api.fetchRulerRulesGroup).toHaveBeenCalledTimes(4));

    // check that only rules sources that have ruler available are there
    const dataSourceSelect = ui.inputs.dataSource.get();
    userEvent.click(byRole('textbox').get(dataSourceSelect));
    expect(await byText('loki with ruler').find(dataSourceSelect)).toBeInTheDocument();
    expect(byText('cortex with ruler').query(dataSourceSelect)).toBeInTheDocument();
    expect(byText('loki with local rule store').query(dataSourceSelect)).not.toBeInTheDocument();
    expect(byText('prom without ruler api').query(dataSourceSelect)).not.toBeInTheDocument();
    expect(byText('splunk').query(dataSourceSelect)).not.toBeInTheDocument();
  });
});

const clickSelectOption = (selectElement: HTMLElement, optionText: Matcher): void => {
  userEvent.click(byRole('textbox').get(selectElement));
  userEvent.click(byText(optionText).get(selectElement));
};
