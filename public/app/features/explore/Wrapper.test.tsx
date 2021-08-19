import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Wrapper from './Wrapper';
import { configureStore } from '../../store/configureStore';
import { Provider } from 'react-redux';
import { locationService, setDataSourceSrv, setEchoSrv } from '@grafana/runtime';
import {
  ArrayDataFrame,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  QueryEditorProps,
  ScopedVars,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { setTimeSrv } from '../dashboard/services/TimeSrv';
import { from, Observable } from 'rxjs';
import { LokiDatasource } from '../../plugins/datasource/loki/datasource';
import { LokiQuery } from '../../plugins/datasource/loki/types';
import { fromPairs } from 'lodash';
import { EnhancedStore } from '@reduxjs/toolkit';
import userEvent from '@testing-library/user-event';
import { splitOpen } from './state/main';
import { Route, Router } from 'react-router-dom';
import { GrafanaRoute } from 'app/core/navigation/GrafanaRoute';
import { initialUserState } from '../profile/state/reducers';
import { Echo } from 'app/core/services/echo/Echo';

type Mock = jest.Mock;

jest.mock('react-virtualized-auto-sizer', () => {
  return {
    __esModule: true,
    default(props: any) {
      return <div>{props.children({ width: 1000 })}</div>;
    },
  };
});

describe('Wrapper', () => {
  it('shows warning if there are no data sources', async () => {
    setup({ datasources: [] });
    // Will throw if isn't found
    screen.getByText(/Explore requires at least one data source/i);
  });

  it('inits url and renders editor but does not call query on empty url', async () => {
    const { datasources } = setup();

    // Wait for rendering the editor
    await screen.findByText(/Editor/i);

    // At this point url should be initialised to some defaults
    expect(locationService.getSearchObject()).toEqual({
      orgId: '1',
      left: JSON.stringify(['now-1h', 'now', 'loki', {}]),
    });
    expect(datasources.loki.query).not.toBeCalled();
  });

  it('runs query when url contains query and renders results', async () => {
    const query = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]) };
    const { datasources, store } = setup({ query });
    (datasources.loki.query as Mock).mockReturnValueOnce(makeLogsQueryResponse());

    // Make sure we render the logs panel
    await screen.findByText(/^Logs$/);

    // Make sure we render the log line
    await screen.findByText(/custom log line/i);

    // And that the editor gets the expr from the url
    await screen.findByText(`loki Editor input: { label="value"}`);

    // We did not change the url
    expect(locationService.getSearchObject()).toEqual({
      orgId: '1',
      ...query,
    });

    expect(store.getState().explore.richHistory[0]).toMatchObject({
      datasourceId: '1',
      datasourceName: 'loki',
      queries: [{ expr: '{ label="value"}' }],
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

    locationService.partial({
      left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="different"}' }]),
    });

    // Editor renders the new query
    await screen.findByText(`loki Editor input: { label="different"}`);
    // Renders new response
    await screen.findByText(/different log/i);
  });

  it('handles url change and runs the new query with different datasource', async () => {
    const query = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]) };
    const { datasources } = setup({ query });
    (datasources.loki.query as Mock).mockReturnValueOnce(makeLogsQueryResponse());
    // Wait for rendering the logs
    await screen.findByText(/custom log line/i);
    await screen.findByText(`loki Editor input: { label="value"}`);

    (datasources.elastic.query as Mock).mockReturnValueOnce(makeMetricsQueryResponse());

    locationService.partial({
      left: JSON.stringify(['now-1h', 'now', 'elastic', { expr: 'other query' }]),
    });

    // Editor renders the new query
    await screen.findByText(`elastic Editor input: other query`);
    // Renders graph
    await screen.findByText(/Graph/i);
  });

  it('handles changing the datasource manually', async () => {
    const query = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]) };
    const { datasources } = setup({ query });
    (datasources.loki.query as Mock).mockReturnValueOnce(makeLogsQueryResponse());
    // Wait for rendering the editor
    await screen.findByText(/Editor/i);
    await changeDatasource('elastic');

    await screen.findByText('elastic Editor input:');
    expect(datasources.elastic.query).not.toBeCalled();
    expect(locationService.getSearchObject()).toEqual({
      orgId: '1',
      left: JSON.stringify(['now-1h', 'now', 'elastic', {}]),
    });
  });

  it('opens the split pane when split button is clicked', async () => {
    setup();
    // Wait for rendering the editor
    const splitButton = await screen.findByText(/split/i);
    fireEvent.click(splitButton);
    await waitFor(() => {
      const editors = screen.getAllByText('loki Editor input:');
      expect(editors.length).toBe(2);
    });
  });

  it('inits with two panes if specified in url', async () => {
    const query = {
      left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
      right: JSON.stringify(['now-1h', 'now', 'elastic', { expr: 'error' }]),
    };

    const { datasources } = setup({ query });
    (datasources.loki.query as Mock).mockReturnValueOnce(makeLogsQueryResponse());
    (datasources.elastic.query as Mock).mockReturnValueOnce(makeLogsQueryResponse());

    // Make sure we render the logs panel
    await waitFor(() => {
      const logsPanels = screen.getAllByText(/^Logs$/);
      expect(logsPanels.length).toBe(2);
    });

    // Make sure we render the log line
    const logsLines = await screen.findAllByText(/custom log line/i);
    expect(logsLines.length).toBe(2);

    // And that the editor gets the expr from the url
    await screen.findByText(`loki Editor input: { label="value"}`);
    await screen.findByText(`elastic Editor input: error`);

    // We did not change the url
    expect(locationService.getSearchObject()).toEqual({
      orgId: '1',
      ...query,
    });

    // We called the data source query method once
    expect(datasources.loki.query).toBeCalledTimes(1);
    expect((datasources.loki.query as Mock).mock.calls[0][0]).toMatchObject({
      targets: [{ expr: '{ label="value"}' }],
    });

    expect(datasources.elastic.query).toBeCalledTimes(1);
    expect((datasources.elastic.query as Mock).mock.calls[0][0]).toMatchObject({
      targets: [{ expr: 'error' }],
    });
  });

  it('can close a pane from a split', async () => {
    const query = {
      left: JSON.stringify(['now-1h', 'now', 'loki', {}]),
      right: JSON.stringify(['now-1h', 'now', 'elastic', {}]),
    };
    setup({ query });
    const closeButtons = await screen.findAllByTitle(/Close split pane/i);
    userEvent.click(closeButtons[1]);

    await waitFor(() => {
      const logsPanels = screen.queryAllByTitle(/Close split pane/i);
      expect(logsPanels.length).toBe(0);
    });
  });

  it('handles url change to split view', async () => {
    const query = {
      left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
    };
    const { datasources } = setup({ query });
    (datasources.loki.query as Mock).mockReturnValue(makeLogsQueryResponse());
    (datasources.elastic.query as Mock).mockReturnValue(makeLogsQueryResponse());

    locationService.partial({
      left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
      right: JSON.stringify(['now-1h', 'now', 'elastic', { expr: 'error' }]),
    });

    // Editor renders the new query
    await screen.findByText(`loki Editor input: { label="value"}`);
    await screen.findByText(`elastic Editor input: error`);
  });

  it('handles opening split with split open func', async () => {
    const query = {
      left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
    };
    const { datasources, store } = setup({ query });
    (datasources.loki.query as Mock).mockReturnValue(makeLogsQueryResponse());
    (datasources.elastic.query as Mock).mockReturnValue(makeLogsQueryResponse());

    // This is mainly to wait for render so that the left pane state is initialized as that is needed for splitOpen
    // to work
    await screen.findByText(`loki Editor input: { label="value"}`);

    store.dispatch(
      splitOpen<any>({ datasourceUid: 'elastic', query: { expr: 'error' } }) as any
    );

    // Editor renders the new query
    await screen.findByText(`elastic Editor input: error`);
    await screen.findByText(`loki Editor input: { label="value"}`);
  });

  it('changes the document title of the explore page to include the datasource in use', async () => {
    const query = {
      left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
    };
    const { datasources } = setup({ query });
    (datasources.loki.query as Mock).mockReturnValue(makeLogsQueryResponse());
    // This is mainly to wait for render so that the left pane state is initialized as that is needed for the title
    // to include the datasource
    await screen.findByText(`loki Editor input: { label="value"}`);

    await waitFor(() => expect(document.title).toEqual('Explore - loki - Grafana'));
  });
  it('changes the document title to include the two datasources in use in split view mode', async () => {
    const query = {
      left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
    };
    const { datasources, store } = setup({ query });
    (datasources.loki.query as Mock).mockReturnValue(makeLogsQueryResponse());
    (datasources.elastic.query as Mock).mockReturnValue(makeLogsQueryResponse());

    // This is mainly to wait for render so that the left pane state is initialized as that is needed for splitOpen
    // to work
    await screen.findByText(`loki Editor input: { label="value"}`);

    store.dispatch(
      splitOpen<any>({ datasourceUid: 'elastic', query: { expr: 'error' } }) as any
    );
    await waitFor(() => expect(document.title).toEqual('Explore - loki | elastic - Grafana'));
  });
});

type DatasourceSetup = { settings: DataSourceInstanceSettings; api: DataSourceApi };
type SetupOptions = {
  datasources?: DatasourceSetup[];
  query?: any;
};

function setup(options?: SetupOptions): { datasources: { [name: string]: DataSourceApi }; store: EnhancedStore } {
  // Clear this up otherwise it persists data source selection
  // TODO: probably add test for that too
  window.localStorage.clear();

  // Create this here so any mocks are recreated on setup and don't retain state
  const defaultDatasources: DatasourceSetup[] = [
    makeDatasourceSetup(),
    makeDatasourceSetup({ name: 'elastic', id: 2 }),
  ];

  const dsSettings = options?.datasources || defaultDatasources;

  setDataSourceSrv({
    getList(): DataSourceInstanceSettings[] {
      return dsSettings.map((d) => d.settings);
    },
    getInstanceSettings(name: string) {
      return dsSettings.map((d) => d.settings).find((x) => x.name === name);
    },
    get(name?: string | null, scopedVars?: ScopedVars): Promise<DataSourceApi> {
      return Promise.resolve((name ? dsSettings.find((d) => d.api.name === name) : dsSettings[0])!.api);
    },
  } as any);

  setTimeSrv({
    init() {},
    getValidIntervals(intervals: string[]): string[] {
      return intervals;
    },
  } as any);
  setEchoSrv(new Echo());

  const store = configureStore();
  store.getState().user = {
    ...initialUserState,
    orgId: 1,
    timeZone: 'utc',
  };

  store.getState().navIndex = {
    explore: {
      id: 'explore',
      text: 'Explore',
      subTitle: 'Explore your data',
      icon: 'compass',
      url: '/explore',
    },
  };

  locationService.push({ pathname: '/explore' });

  if (options?.query) {
    locationService.partial(options.query);
  }

  const route = { component: Wrapper };

  render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <Route path="/explore" exact render={(props) => <GrafanaRoute {...props} route={route as any} />} />
      </Router>
    </Provider>
  );

  return { datasources: fromPairs(dsSettings.map((d) => [d.api.name, d.api])), store };
}

function makeDatasourceSetup({ name = 'loki', id = 1 }: { name?: string; id?: number } = {}): DatasourceSetup {
  const meta: any = {
    info: {
      logos: {
        small: '',
      },
    },
    id: id.toString(),
  };
  return {
    settings: {
      id,
      uid: name,
      type: 'logs',
      name,
      meta,
      access: 'proxy',
      jsonData: {},
    },
    api: {
      components: {
        QueryEditor(props: QueryEditorProps<LokiDatasource, LokiQuery>) {
          return (
            <div>
              {name} Editor input: {props.query.expr}
            </div>
          );
        },
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

async function changeDatasource(name: string) {
  const datasourcePicker = (await screen.findByLabelText(selectors.components.DataSourcePicker.container)).children[0];
  fireEvent.keyDown(datasourcePicker, { keyCode: 40 });
  const option = screen.getByText(name);
  fireEvent.click(option);
}
