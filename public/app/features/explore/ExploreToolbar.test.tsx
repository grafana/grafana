import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';
import { type ExploreState } from 'app/types/explore';

import { type UserState } from '../profile/state/reducers';

import { ExploreToolbar } from './ExploreToolbar';
import { makeExplorePaneState } from './state/utils';

// Keep the real query module (it also exports the reducer the store relies on) but turn runQueries
// into a spy that returns an inert action so we can inspect its payload.
const runQueriesMock = jest.fn((payload: unknown) => ({ type: 'explore/runQueries/mock', payload }));
jest.mock('./state/query', () => {
  const actual = jest.requireActual('./state/query');
  return jest.requireActual('test/helpers/partialMock').partialMock(actual, {
    runQueries: (payload: unknown) => runQueriesMock(payload),
  });
});

// Expose the Run button's onRefresh and the refresh interval's func as trivial buttons.
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  RefreshPicker: ({ onRefresh }: { onRefresh: () => void }) => <button onClick={() => onRefresh()}>run-query</button>,
  SetInterval: ({ func }: { func: (loading?: boolean) => void }) => (
    <button onClick={() => func(false)}>set-interval</button>
  ),
}));

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useFlagGrafanaVisualDesignRefresh: () => false,
}));

// Stub heavy, unrelated children so the toolbar renders in isolation.
jest.mock('app/features/datasources/components/picker/DataSourcePicker', () => ({
  DataSourcePicker: () => null,
}));
jest.mock('./extensions/ToolbarExtensionPoint', () => ({ ToolbarExtensionPoint: () => null }));
jest.mock('./ExploreTimeControls', () => ({ ExploreTimeControls: () => null }));
jest.mock('./ShortLinkButtonMenu', () => ({ ShortLinkButtonMenu: () => null }));
jest.mock('./LiveTailButton', () => ({ LiveTailButton: () => null }));
jest.mock('./useLiveTailControls', () => ({ LiveTailControls: () => null }));

function setup() {
  const leftState = makeExplorePaneState();
  const initialState: ExploreState = {
    richHistory: [],
    panes: {
      left: {
        ...leftState,
        // A truthy refresh interval mounts SetInterval.
        refreshInterval: '5s',
      },
    },
    correlationEditorDetails: { editorMode: false, correlationDirty: false, queryEditorDirty: false, isExiting: false },
    syncedTimes: false,
    richHistoryStorageFull: false,
    richHistoryLimitExceededWarningShown: false,
  } as unknown as ExploreState;

  const store = configureStore({ explore: initialState, user: { orgId: 1 } as UserState });

  render(
    <Provider store={store}>
      <ExploreToolbar
        exploreId="left"
        onChangeTime={jest.fn()}
        onContentOutlineToogle={jest.fn()}
        isContentOutlineOpen={false}
      />
    </Provider>
  );
}

describe('ExploreToolbar run vs refresh interval', () => {
  beforeEach(() => {
    runQueriesMock.mockClear();
  });

  it('dispatches runQueries with userInitiated: true when the Run button is pressed', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('button', { name: 'run-query' }));

    expect(runQueriesMock).toHaveBeenCalledWith(expect.objectContaining({ exploreId: 'left', userInitiated: true }));
  });

  it('dispatches runQueries with userInitiated: false for the refresh-interval SetInterval callback', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('button', { name: 'set-interval' }));

    // The refresh interval is an automatic run and must opt out of user-initiated semantics,
    // otherwise it would be treated as user-initiated by default under the new semantics.
    expect(runQueriesMock).toHaveBeenCalledWith(expect.objectContaining({ exploreId: 'left', userInitiated: false }));
  });
});
