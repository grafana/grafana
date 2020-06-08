import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { VariablesState } from '../state/variablesReducer';
import { createDataSourceOptions, dataSourceVariableReducer } from './reducer';
import { DataSourceVariableModel } from '../types';
import { getVariableTestContext } from '../state/helpers';
import cloneDeep from 'lodash/cloneDeep';
import { createDataSourceVariableAdapter } from './adapter';
import { DataSourceSelectItem } from '@grafana/data';
import { toVariablePayload } from '../state/types';
import { getMockPlugins } from '../../plugins/__mocks__/pluginMocks';

describe('dataSourceVariableReducer', () => {
  const adapter = createDataSourceVariableAdapter();
  describe('when createDataSourceOptions is dispatched', () => {
    const plugins = getMockPlugins(3);
    const sources: DataSourceSelectItem[] = plugins.map(p => ({
      name: p.name,
      value: `${p.name} value`,
      meta: p,
      sort: '',
    }));

    it.each`
      query                 | regex                           | includeAll | expected
      ${sources[1].meta.id} | ${undefined}                    | ${false}   | ${[{ text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false }]}
      ${'not-found-plugin'} | ${undefined}                    | ${false}   | ${[{ text: 'No data sources found', value: '', selected: false }]}
      ${sources[1].meta.id} | ${/.*(pretty cool plugin-1).*/} | ${false}   | ${[{ text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false }]}
      ${sources[1].meta.id} | ${/.*(pretty cool plugin-2).*/} | ${false}   | ${[{ text: 'No data sources found', value: '', selected: false }]}
      ${sources[1].meta.id} | ${undefined} | ${true} | ${[
  { text: 'All', value: '$__all', selected: false },
  { text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false },
]}
      ${'not-found-plugin'} | ${undefined} | ${true} | ${[
  { text: 'All', value: '$__all', selected: false },
  { text: 'No data sources found', value: '', selected: false },
]}
      ${sources[1].meta.id} | ${/.*(pretty cool plugin-1).*/} | ${true} | ${[
  { text: 'All', value: '$__all', selected: false },
  { text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false },
]}
      ${sources[1].meta.id} | ${/.*(pretty cool plugin-2).*/} | ${true} | ${[
  { text: 'All', value: '$__all', selected: false },
  { text: 'No data sources found', value: '', selected: false },
]}
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
            ['0']: ({
              ...initialState['0'],
              options: expected,
            } as unknown) as DataSourceVariableModel,
          });
      }
    );
  });
});
