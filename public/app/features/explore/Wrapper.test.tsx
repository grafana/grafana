import React from 'react';
import { render, screen } from '@testing-library/react';
import Wrapper from './Wrapper';
import { configureStore } from '../../store/configureStore';
import { Provider } from 'react-redux';
import { store } from '../../store/store';
import { setDataSourceSrv } from '@grafana/runtime';
import {
  ArrayDataFrame,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  QueryEditorProps,
  ScopedVars,
} from '@grafana/data';
import { setTimeSrv } from '../dashboard/services/TimeSrv';
import { from, Observable } from 'rxjs';
import { updateLocation } from '../../core/reducers/location';
import Mock = jest.Mock;
import { LokiDatasource } from '../../plugins/datasource/loki/datasource';
import { LokiQuery } from '../../plugins/datasource/loki/types';
import { fromPairs } from 'lodash';

// jest.mock('./XRayQueryField', () => {
//   return {
//     __esModule: true,
//     XRayQueryField: jest.fn(props => (
//       <input data-testid={'query-field-mock'} onChange={e => props.onChange({ query: e.target.value })} />
//     )),
//   };
// });

jest.mock('react-virtualized-auto-sizer', () => {
  return {
    __esModule: true,
    default: (props: any) => <div>{props.children({ width: 100 })}</div>,
  };
});
// async function renderWithQuery(query: Omit<XrayQuery, 'refId'>, rerender?: any) {
//   const renderFunc = rerender || render;
//
//   const onChange = jest.fn();
//   let utils: any;
//   await act(async () => {
//     utils = renderFunc(
//       <QueryEditor
//         {...{
//           ...defaultProps,
//           query: {
//             refId: 'A',
//             ...query,
//           },
//         }}
//         onChange={onChange}
//       />
//     );
//     await waitFor(() => {});
//   });
//
//   return { ...utils, onChange };
// }

describe('Wrapper', () => {
  describe('initialization', () => {
    it('shows warning if there are no data sources', async () => {
      setup({ datasources: [] });
      expect(screen.getByText(/Explore requires at least one data source/i)).toBeDefined();
    });

    it('inits url and renders editor but does not call query on empty url', async () => {
      const { datasources } = setup();

      // Wait for rendering the editor
      await screen.findByText(/Editor/i);

      // At this point url should be initialised to some defaults
      expect(store.getState().location.query).toEqual({
        orgId: '1',
        left: JSON.stringify(['now-1h', 'now', 'loki', {}]),
      });
      expect(datasources.loki.query).not.toBeCalled();
    });

    it('runs query when url contains query and renders results', async () => {
      const query = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]) };
      const { datasources } = setup({ query });
      (datasources.loki.query as Mock).mockReturnValueOnce(makeLogsQueryResponse());

      // Make sure we render the logs panel
      await screen.findByText(/^Logs$/i);

      // Make sure we render the log line
      await screen.findByText(/custom log line/i);

      // And that the editor gets the expr from the url
      await screen.findByText(`Editor input: { label="value"}`);

      // We did not change the url
      expect(store.getState().location.query).toEqual({
        orgId: '1',
        ...query,
      });

      // We called the data source query method once
      expect(datasources.loki.query).toBeCalledTimes(1);
      expect((datasources.loki.query as Mock).mock.calls[0][0]).toMatchObject({
        targets: [{ expr: '{ label="value"}' }],
      });
    });

    it('handles url change and runs the new query', async () => {
      const query = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]) };
      const { datasources } = setup({ query });
      (datasources.loki.query as Mock).mockReturnValueOnce(makeLogsQueryResponse());
      // Wait for rendering the logs
      await screen.findByText(/custom log line/i);

      (datasources.loki.query as Mock).mockReturnValueOnce(makeLogsQueryResponse('different log'));
      store.dispatch(
        updateLocation({
          path: '/explore',
          query: { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="different"}' }]) },
        })
      );

      // Editor renders the new query
      await screen.findByText(`Editor input: { label="different"}`);
      // Renders new response
      await screen.findByText(/different log/i);
    });

    it('handles url change and runs the new query with different datasource', async () => {
      const query = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]) };
      const { datasources } = setup({ query });
      (datasources.loki.query as Mock).mockReturnValueOnce(makeLogsQueryResponse());
      // Wait for rendering the logs
      await screen.findByText(/custom log line/i);

      (datasources.elastic.query as Mock).mockReturnValueOnce(makeMetricsQueryResponse());
      store.dispatch(
        updateLocation({
          path: '/explore',
          query: { left: JSON.stringify(['now-1h', 'now', 'elastic', { expr: 'other query' }]) },
        })
      );

      // Editor renders the new query
      await screen.findByText(`Editor input: other query`);
      // Renders graph
      await screen.findByText(/Graph/i);
    });
  });
});

type DatasourceSetup = { settings: DataSourceInstanceSettings; api: DataSourceApi };
type SetupOptions = {
  datasources?: DatasourceSetup[];
  query?: any;
};
function setup(options?: SetupOptions): { datasources: { [name: string]: DataSourceApi } } {
  // Create this here so any mocks are recreated on setup and don't retain state
  const defaultDatasources: DatasourceSetup[] = [makeDatasourceSetup(), makeDatasourceSetup({ name: 'elastic' })];

  const dsSettings = options?.datasources || defaultDatasources;

  setDataSourceSrv({
    getExternal(): DataSourceInstanceSettings[] {
      return dsSettings.map(d => d.settings);
    },

    get(name?: string | null, scopedVars?: ScopedVars): Promise<DataSourceApi> {
      return Promise.resolve((name ? dsSettings.find(d => d.api.name === name) : dsSettings[0])!.api);
    },
  } as any);

  setTimeSrv({
    init() {},
  } as any);

  configureStore();
  store.getState().user = {
    orgId: 1,
    timeZone: 'utc',
  };

  if (options?.query) {
    // We have to dispatch cause right now we take the url state from the action not from the store
    store.dispatch(updateLocation({ query: options.query, path: '/explore' }));
  }

  render(
    <Provider store={store}>
      <Wrapper />
    </Provider>
  );
  return { datasources: fromPairs(dsSettings.map(d => [d.api.name, d.api])) };
}

function makeDatasourceSetup({ name = 'loki' }: { name?: string } = {}): DatasourceSetup {
  const meta: any = {
    info: {
      logos: {
        small: '',
      },
    },
    id: '1',
  };
  return {
    settings: {
      id: 1,
      uid: name,
      type: 'logs',
      name,
      meta,
      jsonData: {},
    },
    api: {
      components: {
        QueryEditor: (props: QueryEditorProps<LokiDatasource, LokiQuery>) => (
          <div>Editor input: {props.query.expr}</div>
        ),
      },
      name: name,
      query: jest.fn(),
      meta,
    } as any,
  };
}

function makeLogsQueryResponse(marker = ''): Observable<DataQueryResponse> {
  const df = new ArrayDataFrame([{ ts: Date.now(), line: `custom log line ${marker}` }]);
  df.meta = {
    preferredVisualisationType: 'logs',
  };
  df.fields[0].type = FieldType.time;
  return from([{ data: [df] }]);
}

function makeMetricsQueryResponse(): Observable<DataQueryResponse> {
  const df = new ArrayDataFrame([{ ts: Date.now(), val: 1 }]);
  df.fields[0].type = FieldType.time;
  return from([{ data: [df] }]);
}
