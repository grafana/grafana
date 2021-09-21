import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { DataSourceJsonData, PluginMeta } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { RuleViewer } from './RuleViewer';
import { configureStore } from 'app/store/configureStore';
import { typeAsJestMock } from '../../../../test/helpers/typeAsJestMock';
import { useCombinedRule } from './hooks/useCombinedRule';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { CombinedRule } from 'app/types/unified-alerting';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

jest.mock('./hooks/useCombinedRule');
jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as any),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: () => ({ name: 'prometheus' }),
    };
  },
}));

const store = configureStore();
const renderRuleViewer = () => {
  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <RuleViewer {...mockRoute} />
      </Router>
    </Provider>
  );
};
describe('RuleViewer', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should render page with grafana alert', () => {
    typeAsJestMock(useCombinedRule).mockReturnValue({
      result: mockGrafanaRule as CombinedRule,
      loading: false,
      dispatched: true,
      requestId: 'A',
      error: undefined,
    });

    renderRuleViewer();
    expect(screen.getByText('Alerting / View rule')).toBeInTheDocument();
    expect(screen.getByText('Test alert')).toBeInTheDocument();
  });

  it('should render page with cloud alert', () => {
    typeAsJestMock(useCombinedRule).mockReturnValue({
      result: mockCloudRule as CombinedRule,
      loading: false,
      dispatched: true,
      requestId: 'A',
      error: undefined,
    });
    renderRuleViewer();
    expect(screen.getByText('Alerting / View rule')).toBeInTheDocument();
    expect(screen.getByText('Cloud test alert')).toBeInTheDocument();
  });
});

const mockGrafanaRule = {
  name: 'Test alert',
  query: 'up',
  labels: {},
  annotations: {},
  group: {
    name: 'Prom up alert',
    rules: [],
  },
  namespace: {
    rulesSource: GRAFANA_RULES_SOURCE_NAME,
    name: 'Alerts',
    groups: [],
  },
  rulerRule: {
    for: '',
    annotations: {},
    labels: {},
    grafana_alert: {
      condition: 'B',
      exec_err_state: GrafanaAlertStateDecision.Alerting,
      namespace_id: 11,
      namespace_uid: 'namespaceuid123',
      no_data_state: GrafanaAlertStateDecision.NoData,
      title: 'Test alert',
      uid: 'asdf23',
      data: [],
    },
  },
};

const mockCloudRule = {
  name: 'Cloud test alert',
  labels: {},
  query: 'up == 0',
  annotations: {},
  group: {
    name: 'test',
    rules: [],
  },
  promRule: {
    health: 'ok',
    name: 'cloud up alert',
    query: 'up == 0',
    type: 'alerting',
  },
  namespace: {
    name: 'prom test alerts',
    groups: [],
    rulesSource: {
      name: 'prom test',
      type: 'prometheus',
      uid: 'asdf23',
      id: 1,
      meta: {} as PluginMeta,
      jsonData: {} as DataSourceJsonData,
      access: 'proxy',
    },
  },
};

const mockRoute: GrafanaRouteComponentProps<{ id?: string; sourceName?: string }> = {
  route: {
    path: '/',
    component: RuleViewer,
  },
  queryParams: { returnTo: '/alerting/list' },
  match: { params: { id: 'test1', sourceName: 'grafana' }, isExact: false, url: 'asdf', path: '' },
  history: locationService.getHistory(),
  location: { pathname: '', hash: '', search: '', state: '' },
  staticContext: {},
};
