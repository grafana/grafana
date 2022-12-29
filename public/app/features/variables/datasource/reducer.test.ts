import { cloneDeep } from 'lodash';

import { DataSourceInstanceSettings } from '@grafana/data';
import { getMockPlugins } from '@grafana/data/test/__mocks__/pluginMocks';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { getDataSourceInstanceSetting } from '../shared/testing/helpers';
import { getVariableTestContext } from '../state/helpers';
import { VariablesState } from '../state/types';
import { DataSourceVariableModel } from '../types';
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
});
