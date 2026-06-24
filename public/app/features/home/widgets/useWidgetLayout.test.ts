import { act, renderHook, waitFor } from '@testing-library/react';

import { type UserStorage } from '@grafana/data';
import { useUserStorage } from '@grafana/runtime/internal';

import {
  type HomeWidgetCatalogEntry,
  panelWidgetId,
  parsePanelWidgetId,
  parseWidgetLayout,
  WIDGET_LAYOUT_VERSION,
} from './types';
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

  it('reconstructs a stripped panel ref from the item id', () => {
    const raw = JSON.stringify({
      version: WIDGET_LAYOUT_VERSION,
      items: [{ id: 'panel:abc:7', x: 4, y: 0, w: 12, h: 9 }],
    });
    expect(parseWidgetLayout(raw)?.items[0]).toEqual({
      id: 'panel:abc:7',
      x: 4,
      y: 0,
      w: 12,
      h: 9,
      panel: { dashboardUid: 'abc', panelId: 7 },
    });
  });

  it('leaves an intact panel item untouched', () => {
    const item = {
      id: 'panel:abc:7',
      x: 0,
      y: 0,
      w: 12,
      h: 9,
      panel: { dashboardUid: 'abc', panelId: 7, title: 'CPU' },
    };
    expect(parseWidgetLayout(JSON.stringify({ version: WIDGET_LAYOUT_VERSION, items: [item] }))?.items[0]).toEqual(
      item
    );
  });

  it('drops a stripped panel item with an unparseable id but keeps unknown non-panel ids', () => {
    const raw = JSON.stringify({
      version: WIDGET_LAYOUT_VERSION,
      items: [
        { id: 'panel:abc:x', x: 0, y: 0, w: 12, h: 9 },
        { id: 'mystery', x: 0, y: 9, w: 12, h: 8 },
      ],
    });
    expect(parseWidgetLayout(raw)?.items).toEqual([{ id: 'mystery', x: 0, y: 9, w: 12, h: 8 }]);
  });
});

describe('parsePanelWidgetId', () => {
  it('round-trips with panelWidgetId, including panel id 0', () => {
    expect(parsePanelWidgetId(panelWidgetId('abc', 7))).toEqual({ dashboardUid: 'abc', panelId: 7 });
    expect(parsePanelWidgetId(panelWidgetId('abc', 0))).toEqual({ dashboardUid: 'abc', panelId: 0 });
  });
  it('returns null for non-panel and malformed ids', () => {
    for (const id of [
      'alerts',
      'panel:abc',
      'panel:abc:',
      'panel::7',
      'panel:abc:7e2',
      'panel:abc:7.2',
      'panel:abc:-1',
      'panel:a:b:7',
    ]) {
      expect(parsePanelWidgetId(id)).toBeNull();
    }
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

  it('reconstructs a stripped panel ref on load', async () => {
    storage = fakeStorage(
      JSON.stringify({ version: WIDGET_LAYOUT_VERSION, items: [{ id: 'panel:d1:3', x: 0, y: 0, w: 12, h: 9 }] })
    );
    mockUseUserStorage.mockReturnValue(storage);

    const { result } = renderHook(() => useWidgetLayout());

    await waitFor(() => expect(result.current.layout).not.toBeNull());
    expect(result.current.layout?.items[0]).toEqual({
      id: 'panel:d1:3',
      x: 0,
      y: 0,
      w: 12,
      h: 9,
      panel: { dashboardUid: 'd1', panelId: 3 },
    });
  });

  it('persists the healed panel ref on the next mutation', async () => {
    storage = fakeStorage(
      JSON.stringify({ version: WIDGET_LAYOUT_VERSION, items: [{ id: 'panel:d1:3', x: 0, y: 0, w: 12, h: 9 }] })
    );
    mockUseUserStorage.mockReturnValue(storage);

    const { result } = renderHook(() => useWidgetLayout());
    await waitFor(() => expect(result.current.layout).not.toBeNull());

    act(() => result.current.setPositions(result.current.layout!.items));

    const written = JSON.parse(storage.setItem.mock.calls.at(-1)![1]);
    expect(written.items[0].panel).toEqual({ dashboardUid: 'd1', panelId: 3 });
  });
});
