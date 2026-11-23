import { configureStore } from 'app/store/configureStore';
import { type StoreState } from 'app/types/store';

import { setTimeSrv, type TimeSrv } from '../../dashboard/services/TimeSrv';

import { initializeExplore, paneReducer, setAddingSavedQueryAction } from './explorePane';
import { createDefaultInitialState } from './testHelpers';
import { makeExplorePaneState } from './utils';

// Keep the real query module (its reducer backs the store) but spy on runQueries so we can inspect the
// userInitiated flag the initial URL-load run passes.
const runQueriesMock = jest.fn((payload: unknown) => ({ type: 'explore/runQueries/mock', payload }));
jest.mock('./query', () => ({
  ...jest.requireActual('./query'),
  runQueries: (payload: unknown) => runQueriesMock(payload),
}));

// Avoid hitting the datasource service / correlations storage during initializeExplore.
jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  loadAndInitDatasource: jest.fn().mockResolvedValue({
    instance: { uid: 'ds1', name: 'testDs', getRef: () => ({ uid: 'ds1' }), meta: { id: 'something' } },
    history: [],
  }),
}));

jest.mock('app/features/correlations/utils', () => ({
  ...jest.requireActual('app/features/correlations/utils'),
  getCorrelationsFromStorage: jest.fn().mockResolvedValue({ correlations: [] }),
}));

describe('explorePane reducer', () => {
  describe('setAddingSavedQueryAction', () => {
    it('sets addingSavedQuery to true', () => {
      const initialState = makeExplorePaneState();
      expect(initialState.addingSavedQuery).toBeUndefined();

      const nextState = paneReducer(
        initialState,
        setAddingSavedQueryAction({ exploreId: 'left', addingSavedQuery: true })
      );

      expect(nextState.addingSavedQuery).toBe(true);
    });

    it('clears addingSavedQuery when set to false', () => {
      const initialState = makeExplorePaneState({ addingSavedQuery: true });

      const nextState = paneReducer(
        initialState,
        setAddingSavedQueryAction({ exploreId: 'left', addingSavedQuery: false })
      );

      expect(nextState.addingSavedQuery).toBe(false);
    });
  });
});

describe('initializeExplore (initial URL load) userInitiated semantics', () => {
  beforeEach(() => {
    runQueriesMock.mockClear();
    setTimeSrv({ init() {} } as unknown as TimeSrv);
  });

  it('runs the initial query as user-initiated (does not pass userInitiated: false)', async () => {
    const { defaultInitialState } = createDefaultInitialState();
    const { dispatch } = configureStore({
      ...defaultInitialState,
    } as unknown as Partial<StoreState>);

    await dispatch(
      initializeExplore({
        exploreId: 'left',
        datasource: { uid: 'ds1' },
        queries: [{ refId: 'A' }],
        range: { from: 'now-1h', to: 'now' },
        compact: false,
        eventBridge: { emit: () => {} } as never,
      })
    );

    // A human opened/changed the page, so the URL-load run must stay user-initiated by default.
    expect(runQueriesMock).toHaveBeenCalledWith(expect.objectContaining({ exploreId: 'left' }));
    const payload = runQueriesMock.mock.calls.at(-1)![0] as { userInitiated?: boolean };
    expect(payload.userInitiated).not.toBe(false);
  });
});
