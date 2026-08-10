import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

import { type DataSourceApi, type DataSourceInstanceSettings } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { type DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { initDataSourceInstanceSettings } from '@grafana/runtime/internal';
import { type DataQuery } from '@grafana/schema';
import { configureStore } from 'app/store/configureStore';
import { type ExploreState } from 'app/types/explore';

import { type UserState } from '../profile/state/reducers';

import { QueryRows } from './QueryRows';
import { updateDatasourceInstanceAction } from './state/datasource';
import { makeExplorePaneState } from './state/utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: () => null,
}));

function setup(queries: DataQuery[], { resolveDatasource = true } = {}) {
  const defaultDs = {
    name: 'newDs',
    uid: 'newDs-uid',
    meta: { id: 'newDs' },
    components: {
      QueryEditor: () => 'newDs query editor',
    },
  } as unknown as DataSourceApi;

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

  // QueryRows resolves its group settings through the new async datasource API, which reads
  // the in-memory instance-settings cache. Seed it so the lookup never falls back to legacy.
  const dsSettings: Record<string, DataSourceInstanceSettings> = {
    'newDs-uid': {
      name: 'newDs',
      uid: 'newDs-uid',
      type: 'newDs',
      isDefault: true,
      meta: { id: 'newDs', mixed: false },
    } as DataSourceInstanceSettings,
    'someDs-uid': {
      name: 'someDs',
      uid: 'someDs-uid',
      type: 'someDs',
      meta: { id: 'someDs', mixed: false },
    } as DataSourceInstanceSettings,
  };
  initDataSourceInstanceSettings(dsSettings, 'newDs');

  // QueryEditorRow still loads the plugin through the legacy service, so it stays seeded
  // until that call site is migrated. getInstanceSettings deliberately has no default-datasource
  // fallback: that keeps the new API's own default resolution under test instead of masking a
  // cache miss behind the legacy path.
  setDataSourceSrv({
    getList() {
      return Object.values(datasources).map((d) => ({ name: d.name }));
    },
    getInstanceSettings(uid: string) {
      return dsSettings[uid];
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
        datasourceInstance: resolveDatasource ? datasources['someDs-uid'] : undefined,
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
    expect(await screen.findByTestId(selectors.components.QueryEditorRow.title('B'))).toBeInTheDocument();
  });

  // Parity with the removed sync call: getInstanceSettings(undefined) returned the default
  // datasource, and the async API keeps that, so an unresolved pane still gets an editor.
  it('renders the default datasource editor when the pane has no resolved datasource', async () => {
    const { store } = setup([{ refId: 'A' }], { resolveDatasource: false });

    render(
      <Provider store={store}>
        <QueryRows exploreId={'left'} changeCompactMode={jest.fn()} />
      </Provider>
    );

    expect(await screen.findAllByText('newDs query editor')).toHaveLength(1);
  });

  // Settings now resolve asynchronously, so a switch leaves a window where the next lookup is
  // in flight. Bailing out during that window would tear down every editor and rebuild it.
  it('keeps the editors mounted while the next datasource settings resolve', async () => {
    const { store, datasources } = setup([{ refId: 'A' }]);

    render(
      <Provider store={store}>
        <QueryRows exploreId={'left'} changeCompactMode={jest.fn()} />
      </Provider>
    );
    await screen.findAllByText('someDs query editor');
    const rowsBeforeSwitch = screen.getByTestId('query-editor-rows');

    await act(async () => {
      store.dispatch(
        updateDatasourceInstanceAction({
          exploreId: 'left',
          datasourceInstance: datasources['newDs-uid'],
          history: [],
        })
      );
    });

    // A remount would replace the container, so node identity is what proves it survived.
    expect(screen.getByTestId('query-editor-rows')).toBe(rowsBeforeSwitch);
    expect(await screen.findAllByText('newDs query editor')).toHaveLength(1);
  });
});
