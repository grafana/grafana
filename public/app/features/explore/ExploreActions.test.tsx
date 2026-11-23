import { render } from '@testing-library/react';
import { type Action, useKBar, useRegisterActions } from 'kbar';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';
import { type ExploreItemState, type ExploreState } from 'app/types/explore';

import { ExploreActions } from './ExploreActions';
import { runQueries } from './state/query';

jest.mock('kbar', () => ({
  ...jest.requireActual('kbar'),
  useKBar: jest.fn(),
  useRegisterActions: jest.fn(),
}));

jest.mock('./state/query', () => ({
  ...jest.requireActual('./state/query'),
  runQueries: jest.fn(() => ({ type: 'mock-run-queries' })),
}));

const useKBarMock = jest.mocked(useKBar);
const useRegisterActionsMock = jest.mocked(useRegisterActions);
const runQueriesMock = jest.mocked(runQueries);

function renderWithPanes(panes: Record<string, Partial<ExploreItemState>>) {
  const store = configureStore({
    explore: { panes } as unknown as ExploreState,
  });

  render(
    <Provider store={store}>
      <ExploreActions />
    </Provider>
  );
}

function lastRegisteredActions(): Action[] {
  const calls = useRegisterActionsMock.mock.calls;
  const [actions] = calls[calls.length - 1] as [Action[], unknown];
  return actions;
}

function lastRegisteredActionIds(): string[] {
  return lastRegisteredActions().map((action) => action.id);
}

function performAction(id: string): void {
  const action = lastRegisteredActions().find((candidate) => candidate.id === id);
  if (!action?.perform) {
    throw new Error(`action ${id} was not registered`);
  }
  action.perform({} as Parameters<NonNullable<Action['perform']>>[0]);
}

describe('ExploreActions', () => {
  beforeEach(() => {
    // A truthy query makes the component register its actions (see `useRegisterActions` gate).
    useKBarMock.mockReturnValue({ query: {} } as ReturnType<typeof useKBar>);
    useRegisterActionsMock.mockClear();
    runQueriesMock.mockClear();
  });

  // Regression test (2026-07-02 DataPro code audit, finding #26): the right-pane split actions were
  // gated behind `panes[1]`, but `panes` is keyed by non-numeric exploreId strings, so the numeric
  // index was always `undefined` and these actions never registered while split.
  it('registers the right-pane split actions when split', () => {
    renderWithPanes({ left: {}, right: {} });

    const ids = lastRegisteredActionIds();
    expect(ids).toEqual(
      expect.arrayContaining([
        'explore/run-query-left',
        'explore/run-query-right',
        'explore/split-view-close-left',
        'explore/split-view-close-right',
      ])
    );
  });

  it('registers the single-pane actions when not split', () => {
    renderWithPanes({ left: {} });

    const ids = lastRegisteredActionIds();
    expect(ids).toEqual(expect.arrayContaining(['explore/run-query', 'explore/split-view-open']));
    expect(ids).not.toContain('explore/run-query-right');
  });

  it.each([
    ['explore/run-query', { left: {} }, 'left'],
    ['explore/run-query-left', { left: {}, right: {} }, 'left'],
    ['explore/run-query-right', { left: {}, right: {} }, 'right'],
  ])('runs %s as a user-initiated run', (id, panes, exploreId) => {
    renderWithPanes(panes);

    performAction(id);

    expect(runQueriesMock).toHaveBeenCalledWith({ exploreId, userInitiated: true });
  });
});
