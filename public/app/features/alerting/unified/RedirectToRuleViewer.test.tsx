import { render, screen } from '@testing-library/react';
import React from 'react';
import { useLocation } from 'react-use';
import { TestProvider } from 'test/helpers/TestProvider';

import { DataSourceJsonData, PluginMeta } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { CombinedRule, Rule } from '../../../types/unified-alerting';
import { PromRuleType } from '../../../types/unified-alerting-dto';

import { RedirectToRuleViewer } from './RedirectToRuleViewer';
import { useCombinedRulesMatching } from './hooks/useCombinedRule';
import * as combinedRuleHooks from './hooks/useCombinedRule';
import { getRulesSourceByName } from './utils/datasource';

jest.mock('./hooks/useCombinedRule');
jest.mock('./utils/datasource');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Redirect: jest.fn(({}) => `Redirected`),
}));

jest.mock('react-use');

const renderRedirectToRuleViewer = (pathname: string) => {
  jest.mocked(useLocation).mockReturnValue({ pathname, trigger: '' });

  locationService.push(pathname);

  return render(
    <TestProvider>
      <RedirectToRuleViewer />
    </TestProvider>
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
    renderRedirectToRuleViewer('/alerting/test prom/prom alert/find');
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
    renderRedirectToRuleViewer('/alerting/test prom/prom alert/find');
    expect(screen.getByText('Redirected')).toBeInTheDocument();
  });

  it('should properly decode rule name', () => {
    const rulesMatchingSpy = jest.spyOn(combinedRuleHooks, 'useCombinedRulesMatching').mockReturnValue({
      result: [mockedRules[0]],
      loading: false,
      dispatched: true,
      requestId: 'A',
      error: undefined,
    });

    const ruleName = 'cloud rule++ !@#$%^&*()-/?';

    renderRedirectToRuleViewer(`/alerting/prom-db/${encodeURIComponent(ruleName)}/find`);

    expect(rulesMatchingSpy).toHaveBeenCalledWith(ruleName, 'prom-db');
    expect(screen.getByText('Redirected')).toBeInTheDocument();
  });

  it('should properly decode source name', () => {
    const rulesMatchingSpy = jest.spyOn(combinedRuleHooks, 'useCombinedRulesMatching').mockReturnValue({
      result: [mockedRules[0]],
      loading: false,
      dispatched: true,
      requestId: 'A',
      error: undefined,
    });

    const sourceName = 'prom<|>++ !@#$%^&*()-/?';

    renderRedirectToRuleViewer(`/alerting/${encodeURIComponent(sourceName)}/prom alert/find`);

    expect(rulesMatchingSpy).toHaveBeenCalledWith('prom alert', sourceName);
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
