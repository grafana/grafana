import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from '../state/reducers';
import { getTemplatingRootReducer } from '../state/helpers';
import { initDashboardTemplating } from '../state/actions';
import { toVariableIdentifier, toVariablePayload } from '../state/types';
import { variableAdapters } from '../adapters';
import { createDataSourceVariableAdapter } from './adapter';
import {
  DataSourceVariableActionDependencies,
  initDataSourceVariableEditor,
  updateDataSourceVariableOptions,
} from './actions';
import { DataSourcePluginMeta, DataSourceSelectItem } from '@grafana/data';
import { getMockPlugin } from '../../plugins/__mocks__/pluginMocks';
import { createDataSourceOptions } from './reducer';
import { setCurrentVariableValue } from '../state/sharedReducer';
import { changeVariableEditorExtended } from '../editor/reducer';
import { datasourceBuilder } from '../shared/testing/builders';

describe('data source actions', () => {
  variableAdapters.setInit(() => [createDataSourceVariableAdapter()]);

  describe('when updateDataSourceVariableOptions is dispatched', () => {
    describe('and there is no regex', () => {
      it('then the correct actions are dispatched', async () => {
        const sources: DataSourceSelectItem[] = [
          {
            name: 'first-name',
            value: 'first-value',
            meta: getMockPlugin({ name: 'mock-data-name', id: 'mock-data-id' }),
            sort: '',
          },
          {
            name: 'second-name',
            value: 'second-value',
            meta: getMockPlugin({ name: 'mock-data-name', id: 'mock-data-id' }),
            sort: '',
          },
        ];

        const getMetricSourcesMock = jest.fn().mockResolvedValue(sources);
        const getDatasourceSrvMock = jest.fn().mockReturnValue({ getMetricSources: getMetricSourcesMock });
        const dependencies: DataSourceVariableActionDependencies = { getDatasourceSrv: getDatasourceSrvMock };
        const datasource = datasourceBuilder()
          .withId('0')
          .withQuery('mock-data-id')
          .build();

        const tester = await reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(initDashboardTemplating([datasource]))
          .whenAsyncActionIsDispatched(
            updateDataSourceVariableOptions(toVariableIdentifier(datasource), dependencies),
            true
          );

        await tester.thenDispatchedActionsShouldEqual(
          createDataSourceOptions(
            toVariablePayload({ type: 'datasource', id: '0' }, { sources, regex: (undefined as unknown) as RegExp })
          ),
          setCurrentVariableValue(
            toVariablePayload(
              { type: 'datasource', id: '0' },
              { option: { text: 'first-name', value: 'first-name', selected: false } }
            )
          )
        );

        expect(getMetricSourcesMock).toHaveBeenCalledTimes(1);
        expect(getMetricSourcesMock).toHaveBeenCalledWith({ skipVariables: true });
        expect(getDatasourceSrvMock).toHaveBeenCalledTimes(1);
      });
    });

    describe('and there is a regex', () => {
      it('then the correct actions are dispatched', async () => {
        const sources: DataSourceSelectItem[] = [
          {
            name: 'first-name',
            value: 'first-value',
            meta: getMockPlugin({ name: 'mock-data-name', id: 'mock-data-id' }),
            sort: '',
          },
          {
            name: 'second-name',
            value: 'second-value',
            meta: getMockPlugin({ name: 'mock-data-name', id: 'mock-data-id' }),
            sort: '',
          },
        ];

        const getMetricSourcesMock = jest.fn().mockResolvedValue(sources);
        const getDatasourceSrvMock = jest.fn().mockReturnValue({ getMetricSources: getMetricSourcesMock });
        const dependencies: DataSourceVariableActionDependencies = { getDatasourceSrv: getDatasourceSrvMock };
        const datasource = datasourceBuilder()
          .withId('0')
          .withQuery('mock-data-id')
          .withRegEx('/.*(second-name).*/')
          .build();
        const tester = await reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(initDashboardTemplating([datasource]))
          .whenAsyncActionIsDispatched(
            updateDataSourceVariableOptions(toVariableIdentifier(datasource), dependencies),
            true
          );

        await tester.thenDispatchedActionsShouldEqual(
          createDataSourceOptions(
            toVariablePayload({ type: 'datasource', id: '0' }, { sources, regex: /.*(second-name).*/ })
          ),
          setCurrentVariableValue(
            toVariablePayload(
              { type: 'datasource', id: '0' },
              { option: { text: 'second-name', value: 'second-name', selected: false } }
            )
          )
        );

        expect(getMetricSourcesMock).toHaveBeenCalledTimes(1);
        expect(getMetricSourcesMock).toHaveBeenCalledWith({ skipVariables: true });
        expect(getDatasourceSrvMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when initDataSourceVariableEditor is dispatched', () => {
    it('then the correct actions are dispatched', async () => {
      const sources: DataSourceSelectItem[] = [
        {
          name: 'first-name',
          value: 'first-value',
          meta: getMockPlugin({ name: 'mock-data-name', id: 'mock-data-id' }),
          sort: '',
        },
        {
          name: 'second-name',
          value: 'second-value',
          meta: getMockPlugin({ name: 'mock-data-name', id: 'mock-data-id' }),
          sort: '',
        },
        {
          name: 'mixed-name',
          value: 'mixed-value',
          meta: getMockPlugin(({
            name: 'mixed-data-name',
            id: 'mixed-data-id',
            mixed: true,
          } as unknown) as DataSourcePluginMeta),
          sort: '',
        },
      ];

      const getMetricSourcesMock = jest.fn().mockResolvedValue(sources);
      const getDatasourceSrvMock = jest.fn().mockReturnValue({ getMetricSources: getMetricSourcesMock });
      const dependencies: DataSourceVariableActionDependencies = { getDatasourceSrv: getDatasourceSrvMock };

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenAsyncActionIsDispatched(initDataSourceVariableEditor(dependencies));

      await tester.thenDispatchedActionsShouldEqual(
        changeVariableEditorExtended({
          propName: 'dataSourceTypes',
          propValue: [
            { text: '', value: '' },
            { text: 'mock-data-name', value: 'mock-data-id' },
          ],
        })
      );

      expect(getMetricSourcesMock).toHaveBeenCalledTimes(1);
      expect(getMetricSourcesMock).toHaveBeenCalledWith();
      expect(getDatasourceSrvMock).toHaveBeenCalledTimes(1);
    });
  });
});
