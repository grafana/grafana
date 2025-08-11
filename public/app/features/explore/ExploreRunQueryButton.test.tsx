import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { DatasourceSrvMock, MockDataSourceApi } from 'test/mocks/datasource_srv';

import { DataSourceApi } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { configureStore } from 'app/store/configureStore';
import { ExploreItemState, ExploreState } from 'app/types/explore';

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
  it('should disable run query button if there are no explore IDs', async () => {
    setup({}, 0);
    const runQueryButton = await screen.findByRole('button', { name: /run query/i });
    expect(runQueryButton).toBeDisabled();
  });

  it('should be disabled if the root datasource is undefined (invalid datasource)', async () => {
    setup({
      rootDatasourceUid: undefined,
    });
    const runQueryButton = await screen.findByRole('button', { name: /run query/i });
    expect(runQueryButton).toBeDisabled();
  });

  it('should be disabled if property is set', async () => {
    setup({
      disabled: true,
    });
    const runQueryButton = await screen.findByRole('button', { name: /run query/i });
    expect(runQueryButton).toBeDisabled();
  });

  it('should set new queries without changing DS when running queries from the same datasource', async () => {
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

  it('should change datasource to mixed and set new queries when running queries from mixed datasource', async () => {
    const setQueries = jest.fn();
    const changeDatasource = jest.fn();
    const queries: MockQuery[] = [
      { query: 'query1', refId: 'A', datasource: { type: 'loki', uid: 'loki' } },
      { query: 'query2', refId: 'B', datasource: { type: 'prometheus', uid: 'prometheus' } },
    ];
    setup({
      setQueries,
      changeDatasource,
      rootDatasourceUid: 'mixed',
      queries,
    });

    const runQueryButton = await screen.findByRole('button', { name: /run query/i });
    await userEvent.click(runQueryButton);

    await waitFor(() => {
      expect(setQueries).toHaveBeenCalledWith(expect.any(String), queries);
      expect(changeDatasource).toHaveBeenCalledWith({ datasource: 'mixed', exploreId: 'left' });
    });
  });
});
