import {
  DataQueryRequest,
  DataSourceApi,
  DataSourceRef,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  PluginType,
  toDataFrame,
  VariableSupportType,
} from '@grafana/data';
import { lastValueFrom, of } from 'rxjs';
import { SceneFlexLayout } from '../../components';
import { SceneVariableSet } from '../sets/SceneVariableSet';

import { QueryVariable } from './QueryVariable';

const runRequest = jest.fn().mockReturnValue(
  of<PanelData>({
    state: LoadingState.Done,
    series: [
      toDataFrame({
        fields: [{ name: 'text', type: FieldType.string, values: ['A', 'B', 'C'] }],
      }),
    ],
    timeRange: getDefaultTimeRange(),
  })
);

jest.mock('app/features/query/state/runRequest', () => ({
  ...jest.requireActual('app/features/query/state/runRequest'),
  runRequest: (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequest(ds, request);
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: (ds: DataSourceRef): Promise<DataSourceApi> => {
      return Promise.resolve({
        name: 'fake-std',
        type: 'fake-std',
        getRef: () => ({ type: 'fake-std', uid: 'fake-std' }),
        query: () =>
          Promise.resolve({
            data: [],
          }),
        testDatasource: () => Promise.resolve({ status: 'success' }),
        meta: {
          id: 'fake-std',
          type: PluginType.datasource,
          module: 'fake-std',
          baseUrl: '',
          name: 'fake-std',
          info: {
            author: { name: '' },
            description: '',
            links: [],
            logos: { large: '', small: '' },
            updated: '',
            version: '',
            screenshots: [],
          },
        },
        // Standard variable support
        variables: {
          getType: () => VariableSupportType.Standard,
          toDataQuery: (q) => ({ ...q, refId: 'StandardVariableQuery-refId' }),
        },
        id: 1,
        uid: 'fake-std',
      });
    },
  }),
}));

describe('QueryVariable', () => {
  describe('When empty query is provided', () => {
    it('Should default to empty options and empty value', async () => {
      const variable = new QueryVariable({
        name: 'test',
        datasource: { uid: 'fake', type: 'fake' },
        query: '',
      });

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.value).toEqual('');
      expect(variable.state.text).toEqual('');
      expect(variable.state.options).toEqual([]);
    });
  });

  describe('When no data source is provided', () => {
    it('Should default to empty options and empty value', async () => {
      const variable = new QueryVariable({
        name: 'test',
      });

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.value).toEqual('');
      expect(variable.state.text).toEqual('');
      expect(variable.state.options).toEqual([]);
    });
  });

  describe('Standard variable support', () => {
    it('Should provide variable options', async () => {
      const variable = new QueryVariable({
        name: 'test',
        datasource: { uid: 'fake-std', type: 'fake-std' },
        query: 'query',
      });

      const scene = new SceneFlexLayout({
        $variables: new SceneVariableSet({
          variables: [variable],
        }),
        children: [],
      });

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.options).toEqual([
        { label: 'A', value: 'A' },
        { label: 'B', value: 'B' },
        { label: 'C', value: 'C' },
      ]);
    });
  });

  describe('Legacy variable support', () => {});

  describe('When value provided', () => {
    it('should keep valid value', () => {});
  });

  describe('When regex provided', () => {});

  describe('When searchFilter provided', () => {});
});
