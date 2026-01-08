import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

import { DataSourceApi } from '@grafana/data';
import { DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { configureStore } from 'app/store/configureStore';
import { ExploreState } from 'app/types/explore';

import { UserState } from '../profile/state/reducers';

import { QueryRows } from './QueryRows';
import { makeExplorePaneState } from './state/utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: () => null,
}));

function setup(queries: DataQuery[]) {
  const defaultDs = {
    name: 'newDs',
    uid: 'newDs-uid',
    meta: { id: 'newDs' },
  } as DataSourceApi;

  const datasources: Record<string, DataSourceApi> = {
    'newDs-uid': defaultDs,
    'someDs-uid': {
      name: 'someDs',
      uid: 'someDs-uid',
      meta: { id: 'someDs' },
      components: {
        QueryEditor: () => 'someDs query editor',
      },
    } as unknown as DataSourceApi,
  };

  setDataSourceSrv({
    getList() {
      return Object.values(datasources).map((d) => ({ name: d.name }));
    },
    getInstanceSettings(uid: string) {
      return datasources[uid] || defaultDs;
    },
    get(uid?: string) {
      return Promise.resolve(uid ? datasources[uid] || defaultDs : defaultDs);
    },
  } as unknown as DataSourceSrv);

  const leftState = makeExplorePaneState();
  const initialState: ExploreState = {
    richHistory: [],
    panes: {
      left: {
        ...leftState,
        datasourceInstance: datasources['someDs-uid'],
        queries,
        correlations: [],
      },
    },
    correlationEditorDetails: { editorMode: false, correlationDirty: false, queryEditorDirty: false, isExiting: false },
    syncedTimes: false,
    richHistoryStorageFull: false,
    richHistoryLimitExceededWarningShown: false,
  };
  const store = configureStore({ explore: initialState, user: { orgId: 1 } as UserState });

  return {
    store,
    datasources,
  };
}

describe('Explore QueryRows', () => {
  it('Should duplicate a query and generate a valid refId', async () => {
    const { store } = setup([{ refId: 'A' }]);

    render(
      <Provider store={store}>
        <QueryRows exploreId={'left'} changeCompactMode={jest.fn()} />
      </Provider>
    );

    // waiting for the d&d component to fully render.
    await screen.findAllByText('someDs query editor');

    let duplicateButton = screen.getByLabelText(/Duplicate query/i);

    fireEvent.click(duplicateButton);

    // We should have another row with refId B
    expect(await screen.findByLabelText('Query editor row title B')).toBeInTheDocument();
  });
});
