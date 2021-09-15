import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { configureStore } from 'app/store/configureStore';
import { Provider } from 'react-redux';
import { QueryRows } from './QueryRows';
import { ExploreId, ExploreState } from 'app/types';
import { makeExplorePaneState } from './state/utils';
import { setDataSourceSrv } from '@grafana/runtime';
import { UserState } from '../profile/state/reducers';
import { DataQuery } from '../../../../packages/grafana-data/src';

function setup(queries: DataQuery[]) {
  const defaultDs = {
    name: 'newDs',
    meta: { id: 'newDs' },
  };

  const datasources: Record<string, any> = {
    newDs: defaultDs,
    someDs: {
      name: 'someDs',
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
    getInstanceSettings(name: string) {
      return datasources[name] || defaultDs;
    },
    get(name?: string) {
      return Promise.resolve(name ? datasources[name] || defaultDs : defaultDs);
    },
  } as any);

  const leftState = makeExplorePaneState();
  const initialState: ExploreState = {
    left: {
      ...leftState,
      datasourceInstance: datasources.someDs,
      queries,
    },
    syncedTimes: false,
    right: undefined,
    richHistory: [],
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

    let duplicateButton = screen.getByTitle('Duplicate query');

    fireEvent.click(duplicateButton);

    // We should have another row with refId B
    expect(await screen.findByLabelText('Query editor row title B')).toBeInTheDocument();
  });
});
