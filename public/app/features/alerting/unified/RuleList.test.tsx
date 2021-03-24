import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { configureStore } from 'app/store/configureStore';
import { Provider } from 'react-redux';
import { RuleList } from './RuleList';
import { byTestId } from 'testing-library-selector';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { getAllDataSources } from './utils/config';
import { fetchRules } from './api/prometheus';
import { mockDatasource, mockPromRuleGroup, mockPromRuleNamespace } from './mocks';
import { DataSourceType } from './utils/datasource';
import { SerializedError } from '@reduxjs/toolkit';

jest.mock('./api/prometheus');
jest.mock('./utils/config');

const mocks = {
  getAllDatasourcesMock: typeAsJestMock(getAllDataSources),

  api: {
    fetchRules: typeAsJestMock(fetchRules),
  },
};

const renderRuleList = () => {
  const store = configureStore();

  return render(
    <Provider store={store}>
      <RuleList />
    </Provider>
  );
};

const datasources = {
  prom: mockDatasource({
    name: 'Prometheus',
    type: DataSourceType.Prometheus,
  }),
  loki: mockDatasource({
    name: 'Loki',
    type: DataSourceType.Loki,
  }),
  promBroken: mockDatasource({
    name: 'Prometheus-broken',
    type: DataSourceType.Prometheus,
  }),
};

const ui = {
  ruleGroup: byTestId('rule-group'),
  cloudRulesSourceErrors: byTestId('cloud-rulessource-errors'),
};

describe('RuleList', () => {
  afterEach(() => jest.resetAllMocks());

  it('load & show rule groups from multiple cloud datasources', async () => {
    mocks.getAllDatasourcesMock.mockReturnValue(Object.values(datasources));

    mocks.api.fetchRules.mockImplementation((datasourceName: string) => {
      if (datasourceName === datasources.prom.name) {
        return Promise.resolve([
          mockPromRuleNamespace({
            name: 'default',
            datasourceName: datasources.prom.name,
            groups: [
              mockPromRuleGroup({
                name: 'group-2',
              }),
              mockPromRuleGroup({
                name: 'group-1',
              }),
            ],
          }),
        ]);
      } else if (datasourceName === datasources.loki.name) {
        return Promise.resolve([
          mockPromRuleNamespace({
            name: 'default',
            datasourceName: datasources.loki.name,
            groups: [
              mockPromRuleGroup({
                name: 'group-1',
              }),
            ],
          }),
          mockPromRuleNamespace({
            name: 'lokins',
            datasourceName: datasources.loki.name,
            groups: [
              mockPromRuleGroup({
                name: 'group-1',
              }),
            ],
          }),
        ]);
      } else if (datasourceName === datasources.promBroken.name) {
        return Promise.reject({ message: 'this datasource is broken' } as SerializedError);
      }
      return Promise.reject(new Error(`unexpected datasourceName: ${datasourceName}`));
    });

    await renderRuleList();

    await waitFor(() => expect(mocks.api.fetchRules).toHaveBeenCalledTimes(3));
    const groups = await ui.ruleGroup.findAll();
    expect(groups).toHaveLength(4);

    expect(groups[0]).toHaveTextContent('default > group-1');
    expect(groups[1]).toHaveTextContent('default > group-1');
    expect(groups[2]).toHaveTextContent('default > group-2');
    expect(groups[3]).toHaveTextContent('lokins > group-1');

    const errors = await ui.cloudRulesSourceErrors.find();

    expect(errors).toHaveTextContent('Failed to load rules from Prometheus-broken: this datasource is broken');
  });

  it('expand rule group, rule and alert details', async () => {
    mocks.getAllDatasourcesMock.mockReturnValue([datasources.prom]);
    mocks.api.fetchRules.mockResolvedValue([
      mockPromRuleNamespace({
        groups: [
          mockPromRuleGroup({
            name: 'group-1',
          }),
          mockPromRuleGroup({
            name: 'group-2',
          }),
        ],
      }),
    ]);
  });
});
