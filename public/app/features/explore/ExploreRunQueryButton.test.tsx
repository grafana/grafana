import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { DatasourceSrvMock, MockDataSourceApi } from 'test/mocks/datasource_srv';

import { DataSourceApi } from '@grafana/data';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { configureStore } from 'app/store/configureStore';
import { ExploreItemState, ExploreState } from 'app/types';

import { Props, ExploreRunQueryButton } from './ExploreRunQueryButton';
import { makeExplorePaneState } from './state/utils';

interface MockQuery extends DataQuery {
  query: string;
  queryText?: string;
}

const lokiDs = {
  uid: 'loki',
  name: 'testDs',
  type: 'loki',
  meta: { mixed: false },
  getRef: () => {
    return { type: 'loki', uid: 'loki' };
  },
} as unknown as DataSourceApi;

const promDs = {
  uid: 'prom',
  name: 'testDs2',
  type: 'prom',
  meta: { mixed: false },
  getRef: () => {
    return { type: 'prom', uid: 'prom' };
  },
} as unknown as DataSourceApi;

const datasourceSrv = new DatasourceSrvMock(lokiDs, {
  prom: promDs,
  mixed: {
    uid: 'mixed',
    name: 'testDSMixed',
    type: 'mixed',
    meta: { mixed: true },
  } as MockDataSourceApi,
});

const getDataSourceSrvMock = jest.fn().mockReturnValue(datasourceSrv);
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => getDataSourceSrvMock(),
}));

/*const dsStore: Record<string, DataSourceApi> = {
  prom: promDs,
  loki: lokiDs,
  mixed: {
    uid: 'mixed',
    name: 'testDSMixed',
    type: 'mixed',
    meta: { mixed: true },
  } as MockDataSourceApi,
};

jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
  return {
    getDataSourceSrv: () => ({
      get: (ref: DataSourceRef | string) => {
        console.log('wat');
        const uid = typeof ref === 'string' ? ref : ref.uid;
        if (!uid) {
          return new Error
        if (dsStore[uid]) {
          return Promise.resolve(dsStore[uid]);
        }
        return Promise.reject();
      },
    }),
  };
});*/

const setup = (propOverrides?: Partial<Props>, paneCount = 1) => {
  const props: Props = {
    queries: [],
    rootDatasourceUid: 'loki',
    setQueries: jest.fn(),
    changeDatasource: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const panes: Record<string, ExploreItemState | undefined> = {};

  if (paneCount > 0) {
    panes.left = makeExplorePaneState({ datasourceInstance: lokiDs });
  }
  if (paneCount === 2) {
    panes.right = makeExplorePaneState({ datasourceInstance: lokiDs });
  }

  const store = configureStore({
    explore: {
      panes,
    } as unknown as ExploreState,
  });

  render(
    <Provider store={store}>
      <ExploreRunQueryButton {...props} />
    </Provider>
  );
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('ExploreRunQueryButton', () => {
  it.skip('should disable run query button if there are no explore IDs', async () => {
    setup({}, 0);
    const runQueryButton = await screen.findByRole('button', { name: /run query/i });
    expect(runQueryButton).toBeDisabled();
  });

  it('should be disabled if at least one query datasource is missing when using mixed', async () => {
    const setQueries = jest.fn();
    const changeDatasource = jest.fn();
    const queries: MockQuery[] = [
      { query: 'query1', refId: 'A', datasource: { uid: 'nonexistent-ds' } },
      { query: 'query2', refId: 'B', datasource: { uid: 'loki' } },
    ];
    setup({
      rootDatasourceUid: 'mixed',
      queries,
      setQueries,
      changeDatasource,
    });
    const runQueryButton = await screen.findByRole('button', { name: /run query/i });
    expect(runQueryButton).toBeDisabled();
  });

  it.skip('should be disabled if at datasource is missing', async () => {
    const setQueries = jest.fn();
    const changeDatasource = jest.fn();
    const queries: MockQuery[] = [
      { query: 'query1', refId: 'A' },
      { query: 'query2', refId: 'B' },
    ];
    setup({
      setQueries,
      changeDatasource,
      queries,
      rootDatasourceUid: 'nonexistent-ds',
    });
    const runQueryButton = await screen.findByRole('button', { name: /run query/i });
    expect(runQueryButton).toBeDisabled();
  });

  it.skip('should only set new queries when running queries from the same datasource', async () => {
    const setQueries = jest.fn();
    const changeDatasource = jest.fn();
    const queries: MockQuery[] = [
      { query: 'query1', refId: 'A', datasource: { uid: 'loki' } },
      { query: 'query2', refId: 'B', datasource: { uid: 'loki' } },
    ];
    setup({
      setQueries,
      changeDatasource,
      rootDatasourceUid: 'loki',
      queries,
    });
    const runQueryButton = await screen.findByRole('button', { name: /run query/i });
    await userEvent.click(runQueryButton);

    expect(setQueries).toHaveBeenCalledWith(expect.any(String), queries);
    expect(changeDatasource).not.toHaveBeenCalled();
  });
});
