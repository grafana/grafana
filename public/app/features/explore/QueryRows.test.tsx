import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { seedDataSources, watchDataSourceFallbacks } from 'test/helpers/seedDataSources';

import { type DataSourceApi, type DataSourceInstanceSettings } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
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

// The fallback's warning is inert in public/app suites, so green plus a quiet console proves
// nothing. Spy on the logger instead and fail if a lookup resolved through the legacy service.
let dataSourceFallbacks: ReturnType<typeof watchDataSourceFallbacks> | undefined;

afterEach(() => {
  const fallbacks = dataSourceFallbacks;
  dataSourceFallbacks = undefined;
  fallbacks?.expectNoFallbacks(['instance', 'settings', 'list']);
});

function setup(queries: DataQuery[], { resolveDatasource = true } = {}) {
  const fixtures = [
    {
      settings: {
        name: 'newDs',
        uid: 'newDs-uid',
        type: 'newDs',
        isDefault: true,
        meta: { id: 'newDs', mixed: false },
      } as DataSourceInstanceSettings,
      api: {
        name: 'newDs',
        uid: 'newDs-uid',
        meta: { id: 'newDs' },
        components: {
          QueryEditor: () => 'newDs query editor',
        },
      } as unknown as DataSourceApi,
    },
    {
      settings: {
        name: 'someDs',
        uid: 'someDs-uid',
        type: 'someDs',
        meta: { id: 'someDs', mixed: false },
      } as DataSourceInstanceSettings,
      api: {
        name: 'someDs',
        uid: 'someDs-uid',
        meta: { id: 'someDs' },
        components: {
          QueryEditor: () => 'someDs query editor',
        },
      } as unknown as DataSourceApi,
    },
  ];

  // QueryRows resolves its group settings through the new async datasource API; QueryEditorRow
  // still loads the plugin through the legacy service. Seeding both from one fixture set keeps
  // them consistent, and clears the instance cache so re-seeding per test is not a no-op.
  seedDataSources(fixtures, { legacySrv: 'mock' });
  dataSourceFallbacks = watchDataSourceFallbacks();

  const datasources: Record<string, DataSourceApi> = Object.fromEntries(
    fixtures.map((fixture) => [fixture.settings.uid, fixture.api])
  );

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
