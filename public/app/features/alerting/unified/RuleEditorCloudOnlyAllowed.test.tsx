import { screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { byRole, byText } from 'testing-library-selector';

import { setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { PromApiFeatures, PromApplication } from 'app/types/unified-alerting-dto';

import { searchFolders } from '../../manage-dashboards/state/actions';

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

function getDiscoverFeaturesMock(application: PromApplication, features?: Partial<PromApiFeatures['features']>) {
  return {
    application: application,
    features: {
      rulerApiEnabled: false,
      alertManagerConfigApi: false,
      federatedRules: false,
      querySharding: false,
      ...features,
    },
  };
}

describe('RuleEditor cloud: checking editable data sources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contextSrv.isEditor = true;
    contextSrv.hasEditPermissionInFolders = true;
  });

  disableRBAC();

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
        return getDiscoverFeaturesMock(PromApplication.Cortex, { rulerApiEnabled: true });
      }
      if (dataSourceName === 'loki with local rule store') {
        return getDiscoverFeaturesMock(PromApplication.Cortex);
      }
      if (dataSourceName === 'cortex without ruler api') {
        return getDiscoverFeaturesMock(PromApplication.Cortex);
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
