import { act, renderHook } from 'test/test-utils';

import { type NotebookRow, useNotebooksList } from '../list/useNotebooksList';

import { useNotebookPicker } from './useNotebookPicker';

jest.mock('../list/useNotebooksList', () => ({
  useNotebooksList: jest.fn(),
}));

const mockUseNotebooksList = jest.mocked(useNotebooksList);

function row(overrides: Partial<NotebookRow> & { uid: string }): NotebookRow {
  return {
    title: overrides.uid,
    tags: [],
    authorUid: '',
    authorName: 'Anonymous',
    created: Date.UTC(2026, 0, 1),
    updated: Date.UTC(2026, 0, 1),
    ...overrides,
  };
}

function setRows(rows: NotebookRow[]) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only `rows` is read by the picker
  mockUseNotebooksList.mockReturnValue({ rows } as ReturnType<typeof useNotebooksList>);
}

describe('useNotebookPicker', () => {
  const rows = [
    row({ uid: 'a', title: 'Beta', created: Date.UTC(2026, 0, 3), updated: Date.UTC(2026, 1, 1) }),
    row({ uid: 'b', title: 'alpha', created: Date.UTC(2026, 0, 1), updated: Date.UTC(2026, 2, 1) }),
    row({ uid: 'c', title: 'Gamma', created: Date.UTC(2026, 0, 2), updated: Date.UTC(2026, 0, 1) }),
  ];

  beforeEach(() => setRows(rows));

  it('sorts by most recently updated by default', () => {
    const { result } = renderHook(() => useNotebookPicker());

    expect(result.current.rows.map((entry) => entry.uid)).toEqual(['b', 'a', 'c']);
  });

  it.each([
    // Case-insensitive, so 'alpha' is not sorted below every capitalised title.
    ['alphabetical', ['b', 'a', 'c']],
    ['reverse-alphabetical', ['c', 'a', 'b']],
  ] as const)('sorts by %s', (sort, expected) => {
    const { result } = renderHook(() => useNotebookPicker());

    act(() => {
      result.current.setSort(sort);
    });

    expect(result.current.rows.map((entry) => entry.uid)).toEqual(expected);
  });

  it('does not reorder the list the hook was given', () => {
    const { result } = renderHook(() => useNotebookPicker());

    act(() => {
      result.current.setSort('alphabetical');
    });

    expect(rows.map((entry) => entry.uid)).toEqual(['a', 'b', 'c']);
  });
});
