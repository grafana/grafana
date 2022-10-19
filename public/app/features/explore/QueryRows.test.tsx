import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { DataQuery } from '@grafana/data';
import { setDataSourceSrv } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import { ExploreId, ExploreState } from 'app/types';

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
  };

  const datasources: Record<string, any> = {
    'newDs-uid': defaultDs,
    'someDs-uid': {
      name: 'someDs',
      uid: 'someDs-uid',
      meta: { id: 'someDs' },
      components: {
        QueryEditor: () => 'someDs query editor',
      },
    },
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
  } as any);

  const leftState = makeExplorePaneState();
  const initialState: ExploreState = {
    left: {
      ...leftState,
      richHistory: [],
      datasourceInstance: datasources['someDs-uid'],
      queries,
    },
    syncedTimes: false,
    correlations: [],
    right: undefined,
    richHistoryStorageFull: false,
    richHistoryLimitExceededWarningShown: false,
    richHistoryMigrationFailed: false,
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
        <QueryRows exploreId={ExploreId.left} />
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
