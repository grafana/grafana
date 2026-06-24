import { act, renderHook, waitFor } from '@testing-library/react';

import { type UserStorage } from '@grafana/data';
import { useUserStorage } from '@grafana/runtime/internal';

import { type HomeWidgetCatalogEntry, parseWidgetLayout, WIDGET_LAYOUT_VERSION } from './types';
import { useWidgetLayout } from './useWidgetLayout';

jest.mock('@grafana/runtime/internal', () => ({
  useUserStorage: jest.fn(),
}));

const mockUseUserStorage = jest.mocked(useUserStorage);

interface FakeUserStorage extends UserStorage {
  getItem: jest.Mock;
  setItem: jest.Mock;
}

function fakeStorage(initial: string | null = null): FakeUserStorage {
  let value = initial;
  return {
    getItem: jest.fn((_key: string) => Promise.resolve(value)),
    setItem: jest.fn((_key: string, next: string) => {
      value = next;
      return Promise.resolve();
    }),
  };
}

function makeEntry(id: string, w: number, h: number): HomeWidgetCatalogEntry {
  return {
    id,
    title: id,
    description: '',
    icon: 'apps',
    source: 'core',
    defaultSize: { w, h },
    minSize: { w: 1, h: 1 },
    render: () => null,
  };
}

const CATALOG = [makeEntry('alerts', 12, 8), makeEntry('dashboards', 24, 10)];

describe('parseWidgetLayout', () => {
  it('returns null for missing or malformed input', () => {
    expect(parseWidgetLayout(null)).toBeNull();
    expect(parseWidgetLayout('{bad json')).toBeNull();
    expect(parseWidgetLayout(JSON.stringify({ version: 99, items: [] }))).toBeNull();
    // Negative/fractional sizes violate the schema.
    expect(parseWidgetLayout(JSON.stringify({ version: 1, items: [{ id: 'a', x: 0, y: 0, w: 0, h: 1 }] }))).toBeNull();
  });

  it('parses a valid layout round-trip', () => {
    const layout = { version: WIDGET_LAYOUT_VERSION, items: [{ id: 'a', x: 1, y: 2, w: 3, h: 4 }] };
    expect(parseWidgetLayout(JSON.stringify(layout))).toEqual(layout);
  });
});

describe('useWidgetLayout', () => {
  let storage: FakeUserStorage;

  beforeEach(() => {
    storage = fakeStorage();
    mockUseUserStorage.mockReturnValue(storage);
  });

  it('loads first-run (null layout) when storage is empty', async () => {
    const { result } = renderHook(() => useWidgetLayout());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.layout).toBeNull();
  });

  it('initializes from a stored layout', async () => {
    storage = fakeStorage(
      JSON.stringify({ version: WIDGET_LAYOUT_VERSION, items: [{ id: 'dashboards', x: 0, y: 0, w: 24, h: 10 }] })
    );
    mockUseUserStorage.mockReturnValue(storage);

    const { result } = renderHook(() => useWidgetLayout());

    await waitFor(() => expect(result.current.layout).not.toBeNull());
    expect(result.current.layout?.items).toEqual([{ id: 'dashboards', x: 0, y: 0, w: 24, h: 10 }]);
  });

  it('addWidget appends below existing widgets, is idempotent, and persists JSON', async () => {
    const { result } = renderHook(() => useWidgetLayout());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.addWidget(CATALOG[0])); // alerts 12x8 -> y 0
    expect(result.current.layout?.items).toEqual([{ id: 'alerts', x: 0, y: 0, w: 12, h: 8 }]);

    act(() => result.current.addWidget(CATALOG[1])); // dashboards 24x10 -> y = 0 + 8
    expect(result.current.layout?.items).toEqual([
      { id: 'alerts', x: 0, y: 0, w: 12, h: 8 },
      { id: 'dashboards', x: 0, y: 8, w: 24, h: 10 },
    ]);

    act(() => result.current.addWidget(CATALOG[0])); // duplicate -> no-op
    expect(result.current.layout?.items).toHaveLength(2);

    const lastWrite = storage.setItem.mock.calls.at(-1);
    expect(lastWrite?.[0]).toBe('widget-layout');
    expect(JSON.parse(lastWrite?.[1])).toEqual({
      version: WIDGET_LAYOUT_VERSION,
      items: [
        { id: 'alerts', x: 0, y: 0, w: 12, h: 8 },
        { id: 'dashboards', x: 0, y: 8, w: 24, h: 10 },
      ],
    });
  });

  it('removeWidget deletes by id', async () => {
    const { result } = renderHook(() => useWidgetLayout());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.addWidget(CATALOG[0]));
    act(() => result.current.addWidget(CATALOG[1]));
    act(() => result.current.removeWidget('alerts'));

    expect(result.current.layout?.items).toEqual([{ id: 'dashboards', x: 0, y: 8, w: 24, h: 10 }]);
  });

  it('setPositions replaces items wholesale', async () => {
    const { result } = renderHook(() => useWidgetLayout());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const next = [{ id: 'dashboards', x: 3, y: 4, w: 20, h: 9 }];
    act(() => result.current.setPositions(next));

    expect(result.current.layout?.items).toEqual(next);
  });

  it('applyPreset packs available widget ids deterministically', async () => {
    const { result } = renderHook(() => useWidgetLayout());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.applyPreset(['alerts', 'dashboards'], CATALOG));

    // alerts (12 wide) fills the first row; dashboards (24 wide) wraps to y = 8.
    expect(result.current.layout?.items).toEqual([
      { id: 'alerts', x: 0, y: 0, w: 12, h: 8 },
      { id: 'dashboards', x: 0, y: 8, w: 24, h: 10 },
    ]);
  });

  it('applyPreset drops ids missing from the catalog', async () => {
    const { result } = renderHook(() => useWidgetLayout());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.applyPreset(['alerts', 'unknown', 'dashboards'], CATALOG));

    expect(result.current.layout?.items.map((i) => i.id)).toEqual(['alerts', 'dashboards']);
  });
});
