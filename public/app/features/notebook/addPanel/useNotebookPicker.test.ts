import { act, renderHook } from 'test/test-utils';

import { useNotebookPicker } from './useNotebookPicker';
import { type NotebookPickerRow, useNotebookPickerData } from './useNotebookPickerData';

jest.mock('./useNotebookPickerData', () => ({
  useNotebookPickerData: jest.fn(),
}));

const mockUseNotebookPickerData = jest.mocked(useNotebookPickerData);

function row(overrides: Partial<NotebookPickerRow> & { uid: string }): NotebookPickerRow {
  return {
    title: overrides.uid,
    tags: [],
    authorUid: '',
    authorName: 'Anonymous',
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T00:00:00Z',
    blockCount: 0,
    ...overrides,
  };
}

function setRows(rows: NotebookPickerRow[]) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only `rows` is read by the picker
  mockUseNotebookPickerData.mockReturnValue({ rows } as ReturnType<typeof useNotebookPickerData>);
}

describe('useNotebookPicker', () => {
  const rows = [
    row({ uid: 'a', title: 'Beta', created: '2026-01-03T00:00:00Z', updated: '2026-02-01T00:00:00Z' }),
    row({ uid: 'b', title: 'alpha', created: '2026-01-01T00:00:00Z', updated: '2026-03-01T00:00:00Z' }),
    row({ uid: 'c', title: 'Gamma', created: '2026-01-02T00:00:00Z', updated: '2026-01-01T00:00:00Z' }),
  ];

  beforeEach(() => setRows(rows));

  it('sorts by most recently updated by default', () => {
    const { result } = renderHook(() => useNotebookPicker());

    expect(result.current.rows.map((entry) => entry.uid)).toEqual(['b', 'a', 'c']);
  });

  it.each([
    ['created', ['a', 'c', 'b']],
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
