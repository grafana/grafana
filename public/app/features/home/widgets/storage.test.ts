import { UserStorage } from '@grafana/runtime/internal';

import { pinPanelToHomepage } from './storage';
import { parseWidgetLayout } from './types';

jest.mock('@grafana/runtime/internal', () => ({ UserStorage: jest.fn() }));

const MockUserStorage = jest.mocked(UserStorage);

interface Fake {
  getItem: jest.Mock;
  setItem: jest.Mock;
}

function fakeStorage(initial: string | null): Fake {
  let value = initial;
  return {
    getItem: jest.fn(() => Promise.resolve(value)),
    setItem: jest.fn((_key: string, next: string) => {
      value = next;
      return Promise.resolve();
    }),
  };
}

describe('pinPanelToHomepage', () => {
  afterEach(() => jest.clearAllMocks());

  function withStored(raw: string | null): Fake {
    const storage = fakeStorage(raw);
    MockUserStorage.mockImplementation(() => storage as unknown as UserStorage);
    return storage;
  }

  it('appends a single panel item to a fresh layout', async () => {
    const storage = withStored(null);

    await pinPanelToHomepage({ dashboardUid: 'd1', panelId: 3, title: 'CPU' });

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    const [key, json] = storage.setItem.mock.calls[0];
    expect(key).toBe('widget-layout');
    expect(JSON.parse(json)).toEqual({
      version: 1,
      items: [{ id: 'panel:d1:3', x: 0, y: 0, w: 12, h: 9, panel: { dashboardUid: 'd1', panelId: 3, title: 'CPU' } }],
    });
  });

  it('is a no-op when the same panel is already pinned', async () => {
    const storage = withStored(
      JSON.stringify({
        version: 1,
        items: [{ id: 'panel:d1:3', x: 0, y: 0, w: 12, h: 9, panel: { dashboardUid: 'd1', panelId: 3, title: 'CPU' } }],
      })
    );

    await pinPanelToHomepage({ dashboardUid: 'd1', panelId: 3, title: 'CPU' });

    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('starts a fresh layout when the stored value is invalid', async () => {
    const storage = withStored('{bad');

    await pinPanelToHomepage({ dashboardUid: 'd1', panelId: 3 });

    const parsed = parseWidgetLayout(storage.setItem.mock.calls[0][1]);
    expect(parsed?.items).toHaveLength(1);
    expect(parsed?.items[0].id).toBe('panel:d1:3');
  });

  it('places the new panel below the lowest existing item', async () => {
    const storage = withStored(JSON.stringify({ version: 1, items: [{ id: 'alerts', x: 0, y: 2, w: 12, h: 8 }] }));

    await pinPanelToHomepage({ dashboardUid: 'd1', panelId: 7 });

    const parsed = parseWidgetLayout(storage.setItem.mock.calls[0][1]);
    const pinned = parsed?.items.find((item) => item.id === 'panel:d1:7');
    expect(pinned?.y).toBe(10); // 2 (y) + 8 (h)
  });

  it('is a no-op when re-pinning a panel whose stored item lost its panel ref', async () => {
    const storage = withStored(JSON.stringify({ version: 1, items: [{ id: 'panel:d1:3', x: 0, y: 0, w: 12, h: 9 }] }));

    await pinPanelToHomepage({ dashboardUid: 'd1', panelId: 3, title: 'CPU' });

    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('heals a stripped existing panel item when a different panel is pinned', async () => {
    const storage = withStored(JSON.stringify({ version: 1, items: [{ id: 'panel:d1:3', x: 0, y: 0, w: 12, h: 9 }] }));

    await pinPanelToHomepage({ dashboardUid: 'd2', panelId: 4 });

    const parsed = parseWidgetLayout(storage.setItem.mock.calls[0][1]);
    expect(parsed?.items.find((i) => i.id === 'panel:d1:3')?.panel).toEqual({ dashboardUid: 'd1', panelId: 3 });
    expect(parsed?.items.find((i) => i.id === 'panel:d2:4')?.panel).toEqual({ dashboardUid: 'd2', panelId: 4 });
  });
});
