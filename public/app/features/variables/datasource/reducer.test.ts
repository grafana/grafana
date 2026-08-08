import { cloneDeep } from 'lodash';

import { type DataSourceInstanceSettings, type DataSourceVariableModel } from '@grafana/data';
import { getMockPlugins } from '@grafana/data/test';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { getDataSourceInstanceSetting } from '../shared/testing/helpers';
import { getVariableTestContext } from '../state/helpers';
import { type VariablesState } from '../state/types';
import { toVariablePayload } from '../utils';

import { createDataSourceVariableAdapter } from './adapter';
import { createDataSourceOptions, dataSourceVariableReducer } from './reducer';

describe('dataSourceVariableReducer', () => {
  const adapter = createDataSourceVariableAdapter();
  describe('when createDataSourceOptions is dispatched', () => {
    const plugins = getMockPlugins(3);
    const sources: DataSourceInstanceSettings[] = plugins.map((p) => getDataSourceInstanceSetting(p.name, p));

    it.each`
      query                 | regex                           | includeAll | expected
      ${sources[1].meta.id} | ${undefined}                    | ${false}   | ${[{ text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false }]}
      ${'not-found-plugin'} | ${undefined}                    | ${false}   | ${[{ text: 'No data sources found', value: '', selected: false }]}
      ${sources[1].meta.id} | ${/.*(pretty cool plugin-1).*/} | ${false}   | ${[{ text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false }]}
      ${sources[1].meta.id} | ${/.*(pretty cool plugin-2).*/} | ${false}   | ${[{ text: 'No data sources found', value: '', selected: false }]}
      ${sources[1].meta.id} | ${undefined}                    | ${true}    | ${[{ text: 'All', value: '$__all', selected: false }, { text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false }]}
      ${'not-found-plugin'} | ${undefined}                    | ${true}    | ${[{ text: 'All', value: '$__all', selected: false }, { text: 'No data sources found', value: '', selected: false }]}
      ${sources[1].meta.id} | ${/.*(pretty cool plugin-1).*/} | ${true}    | ${[{ text: 'All', value: '$__all', selected: false }, { text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false }]}
      ${sources[1].meta.id} | ${/.*(pretty cool plugin-2).*/} | ${true}    | ${[{ text: 'All', value: '$__all', selected: false }, { text: 'No data sources found', value: '', selected: false }]}
    `(
      "when called with query: '$query' and regex: '$regex' and includeAll: '$includeAll' then state should be correct",
      ({ query, regex, includeAll, expected }) => {
        const { initialState } = getVariableTestContext<DataSourceVariableModel>(adapter, { query, includeAll });
        const payload = toVariablePayload({ id: '0', type: 'datasource' }, { sources, regex });

        reducerTester<VariablesState>()
          .givenReducer(dataSourceVariableReducer, cloneDeep(initialState))
          .whenActionIsDispatched(createDataSourceOptions(payload))
          .thenStateShouldEqual({
            ...initialState,
            ['0']: {
              ...initialState['0'],
              options: expected,
            } as unknown as DataSourceVariableModel,
          });
      }
    );
  });

  describe('when createDataSourceOptions is dispatched and item is default data source', () => {
    it('then the state should include an extra default option', () => {
      const plugins = getMockPlugins(3);
      const sources: DataSourceInstanceSettings[] = plugins.map((p) => getDataSourceInstanceSetting(p.name, p));
      sources[1].isDefault = true;

      const { initialState } = getVariableTestContext<DataSourceVariableModel>(adapter, {
        query: sources[1].meta.id,
        includeAll: false,
      });
      const payload = toVariablePayload({ id: '0', type: 'datasource' }, { sources, regex: undefined });

      reducerTester<VariablesState>()
        .givenReducer(dataSourceVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createDataSourceOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          ['0']: {
            ...initialState['0'],
            options: [
              { text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false },
              { text: 'default', value: 'default', selected: false },
            ],
          } as unknown as DataSourceVariableModel,
        });
    });
  });

  describe('when createDataSourceOptions is dispatched with default in the regex and item is default data source', () => {
    it('then the state should include an extra default option', () => {
      const plugins = getMockPlugins(3);
      const sources: DataSourceInstanceSettings[] = plugins.map((p) => getDataSourceInstanceSetting(p.name, p));
      sources[1].isDefault = true;

      const { initialState } = getVariableTestContext<DataSourceVariableModel>(adapter, {
        query: sources[1].meta.id,
        includeAll: false,
      });
      const payload = toVariablePayload({ id: '0', type: 'datasource' }, { sources, regex: /default/ });

      reducerTester<VariablesState>()
        .givenReducer(dataSourceVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createDataSourceOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          ['0']: {
            ...initialState['0'],
            options: [{ text: 'default', value: 'default', selected: false }],
          } as unknown as DataSourceVariableModel,
        });
    });
  });

  describe('when createDataSourceOptions is dispatched without default in the regex and item is default data source', () => {
    it('then the state not should include an extra default option', () => {
      const plugins = getMockPlugins(3);
      const sources: DataSourceInstanceSettings[] = plugins.map((p) => getDataSourceInstanceSetting(p.name, p));
      sources[1].isDefault = true;

      const { initialState } = getVariableTestContext<DataSourceVariableModel>(adapter, {
        query: sources[1].meta.id,
        includeAll: false,
      });
      const payload = toVariablePayload({ id: '0', type: 'datasource' }, { sources, regex: /pretty/ });

      reducerTester<VariablesState>()
        .givenReducer(dataSourceVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createDataSourceOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          ['0']: {
            ...initialState['0'],
            options: [{ text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false }],
          } as unknown as DataSourceVariableModel,
        });
    });
  });

  describe('when createDataSourceOptions is dispatched without the regex and item is default data source', () => {
    it('then the state should include an extra default option', () => {
      const plugins = getMockPlugins(3);
      const sources: DataSourceInstanceSettings[] = plugins.map((p) => getDataSourceInstanceSetting(p.name, p));
      sources[1].isDefault = true;

      const { initialState } = getVariableTestContext<DataSourceVariableModel>(adapter, {
        query: sources[1].meta.id,
        includeAll: false,
      });
      const payload = toVariablePayload({ id: '0', type: 'datasource' }, { sources, regex: undefined });

      reducerTester<VariablesState>()
        .givenReducer(dataSourceVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createDataSourceOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          ['0']: {
            ...initialState['0'],
            options: [
              { text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false },
              { text: 'default', value: 'default', selected: false },
            ],
          } as unknown as DataSourceVariableModel,
        });
    });
  });

  describe('when createDataSourceOptions is dispatched with labels filter', () => {
    it('should include only datasources that match the label filter', () => {
      const plugins = getMockPlugins(3);
      const sources: DataSourceInstanceSettings[] = plugins.map((p) => getDataSourceInstanceSetting(p.name, p));
      sources[0].labels = { env: 'prod', team: 'frontend' };
      sources[1].labels = { env: 'staging', team: 'frontend' };
      sources[2].labels = { env: 'prod', team: 'backend' };

      const { initialState } = getVariableTestContext<DataSourceVariableModel>(adapter, {
        query: sources[0].meta.id,
        labels: { env: 'prod' },
      });
      const payload = toVariablePayload({ id: '0', type: 'datasource' }, { sources, regex: undefined });

      reducerTester<VariablesState>()
        .givenReducer(dataSourceVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createDataSourceOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          ['0']: {
            ...initialState['0'],
            options: [{ text: 'pretty cool plugin-0', value: 'pretty cool plugin-0', selected: false }],
          } as unknown as DataSourceVariableModel,
        });
    });

    it('should filter by both regex and label filter combined', () => {
      const plugins = getMockPlugins(3);
      const sources: DataSourceInstanceSettings[] = plugins.map((p) => getDataSourceInstanceSetting(p.name, p));
      sources[0].labels = { env: 'prod' };
      sources[1].labels = { env: 'prod' };

      const { initialState } = getVariableTestContext<DataSourceVariableModel>(adapter, {
        query: sources[0].meta.id,
        labels: { env: 'prod' },
      });
      const payload = toVariablePayload({ id: '0', type: 'datasource' }, { sources, regex: /.*plugin-0.*/ });

      reducerTester<VariablesState>()
        .givenReducer(dataSourceVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createDataSourceOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          ['0']: {
            ...initialState['0'],
            options: [{ text: 'pretty cool plugin-0', value: 'pretty cool plugin-0', selected: false }],
          } as unknown as DataSourceVariableModel,
        });
    });
  });
});
