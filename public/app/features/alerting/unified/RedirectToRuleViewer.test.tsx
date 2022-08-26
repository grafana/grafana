import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { DataSourceJsonData, PluginMeta } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { CombinedRule, Rule } from '../../../types/unified-alerting';
import { PromRuleType } from '../../../types/unified-alerting-dto';

import { RedirectToRuleViewer } from './RedirectToRuleViewer';
import { useCombinedRulesMatching } from './hooks/useCombinedRule';
import { getRulesSourceByName } from './utils/datasource';

jest.mock('./hooks/useCombinedRule');
jest.mock('./utils/datasource');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Redirect: jest.fn(({}) => `Redirected`),
}));

const store = configureStore();
const renderRedirectToRuleViewer = () => {
  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <RedirectToRuleViewer {...mockRoute('prom alert', 'test prom')} />
      </Router>
    </Provider>
  );
};

const mockRuleSourceByName = () => {
  jest.mocked(getRulesSourceByName).mockReturnValue({
    name: 'prom test',
    type: 'prometheus',
    uid: 'asdf23',
    id: 1,
    meta: {} as PluginMeta,
    jsonData: {} as DataSourceJsonData,
    access: 'proxy',
    readOnly: false,
  });
};

describe('Redirect to Rule viewer', () => {
  it('should list rules that match the same name', () => {
    jest.mocked(useCombinedRulesMatching).mockReturnValue({
      result: mockedRules,
      loading: false,
      dispatched: true,
      requestId: 'A',
      error: undefined,
    });
    mockRuleSourceByName();
    renderRedirectToRuleViewer();
    expect(screen.getAllByText('Cloud test alert')).toHaveLength(2);
  });

  it('should redirect to view rule page if only one match', () => {
    jest.mocked(useCombinedRulesMatching).mockReturnValue({
      result: [mockedRules[0]],
      loading: false,
      dispatched: true,
      requestId: 'A',
      error: undefined,
    });
    mockRuleSourceByName();
    renderRedirectToRuleViewer();
    expect(screen.getByText('Redirected')).toBeInTheDocument();
  });
});

const mockedRules: CombinedRule[] = [
  {
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
      type: PromRuleType.Alerting,
    } as Rule,
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
        readOnly: false,
      },
    },
  },
  {
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
      type: PromRuleType.Alerting,
    } as Rule,
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
        readOnly: false,
      },
    },
  },
];

const mockRoute = (ruleName: string, sourceName: string) => {
  return {
    route: {
      path: '/',
      component: RedirectToRuleViewer,
    },
    queryParams: { returnTo: '/alerting/list' },
    match: { params: { name: ruleName, sourceName: sourceName }, isExact: false, url: 'asdf', path: '' },
    history: locationService.getHistory(),
    location: { pathname: '', hash: '', search: '', state: '' },
    staticContext: {},
  };
};
