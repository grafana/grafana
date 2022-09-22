import { DataSourceInstanceSettings } from '@grafana/data';

import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { getMockPlugin } from '../../plugins/__mocks__/pluginMocks';
import { variableAdapters } from '../adapters';
import { changeVariableEditorExtended } from '../editor/reducer';
import { datasourceBuilder } from '../shared/testing/builders';
import { getDataSourceInstanceSetting } from '../shared/testing/helpers';
import { getRootReducer, RootReducerType } from '../state/helpers';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { addVariable, setCurrentVariableValue } from '../state/sharedReducer';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';

import {
  DataSourceVariableActionDependencies,
  initDataSourceVariableEditor,
  updateDataSourceVariableOptions,
} from './actions';
import { createDataSourceVariableAdapter } from './adapter';
import { createDataSourceOptions } from './reducer';

interface Args {
  sources?: DataSourceInstanceSettings[];
  query?: string;
  regex?: string;
}

function getTestContext({ sources = [], query, regex }: Args = {}) {
  const getListMock = jest.fn().mockReturnValue(sources);
  const getDatasourceSrvMock = jest.fn().mockReturnValue({ getList: getListMock });
  const dependencies: DataSourceVariableActionDependencies = { getDatasourceSrv: getDatasourceSrvMock };
  const datasource = datasourceBuilder().withId('0').withRootStateKey('key').withQuery(query).withRegEx(regex).build();

  return { getListMock, getDatasourceSrvMock, dependencies, datasource };
}

describe('data source actions', () => {
  variableAdapters.setInit(() => [createDataSourceVariableAdapter()]);

  describe('when updateDataSourceVariableOptions is dispatched', () => {
    describe('and there is no regex', () => {
      it('then the correct actions are dispatched', async () => {
        const meta = getMockPlugin({ name: 'mock-data-name', id: 'mock-data-id' });
        const sources: DataSourceInstanceSettings[] = [
          getDataSourceInstanceSetting('first-name', meta),
          getDataSourceInstanceSetting('second-name', meta),
        ];
        const { datasource, dependencies, getListMock, getDatasourceSrvMock } = getTestContext({
          sources,
          query: 'mock-data-id',
        });

        const tester = await reduxTester<RootReducerType>()
          .givenRootReducer(getRootReducer())
          .whenActionIsDispatched(
            toKeyedAction(
              'key',
              addVariable(toVariablePayload(datasource, { global: false, index: 0, model: datasource }))
            )
          )
          .whenAsyncActionIsDispatched(
            updateDataSourceVariableOptions(toKeyedVariableIdentifier(datasource), dependencies),
            true
          );

        tester.thenDispatchedActionsShouldEqual(
          toKeyedAction(
            'key',
            createDataSourceOptions(
              toVariablePayload(
                { type: 'datasource', id: '0' },
                {
                  sources,
                  regex: undefined as unknown as RegExp,
                }
              )
            )
          ),
          toKeyedAction(
            'key',
            setCurrentVariableValue(
              toVariablePayload(
                { type: 'datasource', id: '0' },
                { option: { text: 'first-name', value: 'first-name', selected: false } }
              )
            )
          )
        );

        expect(getListMock).toHaveBeenCalledTimes(1);
        expect(getListMock).toHaveBeenCalledWith({ metrics: true, variables: false });
        expect(getDatasourceSrvMock).toHaveBeenCalledTimes(1);
      });
    });

    describe('and there is a regex', () => {
      it('then the correct actions are dispatched', async () => {
        const meta = getMockPlugin({ name: 'mock-data-name', id: 'mock-data-id' });
        const sources: DataSourceInstanceSettings[] = [
          getDataSourceInstanceSetting('first-name', meta),
          getDataSourceInstanceSetting('second-name', meta),
        ];

        const { datasource, dependencies, getListMock, getDatasourceSrvMock } = getTestContext({
          sources,
          query: 'mock-data-id',
          regex: '/.*(second-name).*/',
        });

        const tester = await reduxTester<RootReducerType>()
          .givenRootReducer(getRootReducer())
          .whenActionIsDispatched(
            toKeyedAction(
              'key',
              addVariable(toVariablePayload(datasource, { global: false, index: 0, model: datasource }))
            )
          )
          .whenAsyncActionIsDispatched(
            updateDataSourceVariableOptions(toKeyedVariableIdentifier(datasource), dependencies),
            true
          );

        tester.thenDispatchedActionsShouldEqual(
          toKeyedAction(
            'key',
            createDataSourceOptions(
              toVariablePayload(
                { type: 'datasource', id: '0' },
                {
                  sources,
                  regex: /.*(second-name).*/,
                }
              )
            )
          ),
          toKeyedAction(
            'key',
            setCurrentVariableValue(
              toVariablePayload(
                { type: 'datasource', id: '0' },
                { option: { text: 'second-name', value: 'second-name', selected: false } }
              )
            )
          )
        );

        expect(getListMock).toHaveBeenCalledTimes(1);
        expect(getListMock).toHaveBeenCalledWith({ metrics: true, variables: false });
        expect(getDatasourceSrvMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when initDataSourceVariableEditor is dispatched', () => {
    it('then the correct actions are dispatched', () => {
      const meta = getMockPlugin({ name: 'mock-data-name', id: 'mock-data-id' });
      const sources: DataSourceInstanceSettings[] = [
        getDataSourceInstanceSetting('first-name', meta),
        getDataSourceInstanceSetting('second-name', meta),
      ];

      const { dependencies, getListMock, getDatasourceSrvMock } = getTestContext({ sources });

      reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(initDataSourceVariableEditor('key', dependencies))
        .thenDispatchedActionsShouldEqual(
          toKeyedAction(
            'key',
            changeVariableEditorExtended({
              dataSourceTypes: [
                { text: '', value: '' },
                { text: 'mock-data-name', value: 'mock-data-id' },
              ],
            })
          )
        );

      expect(getListMock).toHaveBeenCalledTimes(1);
      expect(getListMock).toHaveBeenCalledWith({ metrics: true, variables: true });
      expect(getDatasourceSrvMock).toHaveBeenCalledTimes(1);
    });
  });
});
