import { renderHook } from '@testing-library/react';

import { type WidgetLayoutItem } from '../types';

import { usePanelWidgetEntries } from './usePanelWidgetEntries';

jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: (_key: string, defaultValue: string) => defaultValue,
}));

// The hook only needs PanelWidget's identity for the render thunk; stub it to avoid loading
// the dashboard-scene serialization graph in this unit test.
jest.mock('./PanelWidget', () => ({ PanelWidget: () => null }));

describe('usePanelWidgetEntries', () => {
  it('maps only panel items to entries', () => {
    const items: WidgetLayoutItem[] = [
      { id: 'panel:d1:3', x: 0, y: 0, w: 12, h: 9, panel: { dashboardUid: 'd1', panelId: 3, title: 'CPU' } },
      { id: 'alerts', x: 0, y: 9, w: 12, h: 8 },
    ];

    const { result } = renderHook(() => usePanelWidgetEntries(items));

    expect(result.current).toHaveLength(1);
    const entry = result.current[0];
    expect(entry.source).toBe('panel');
    expect(entry.id).toBe('panel:d1:3');
    expect(entry.title).toBe('CPU');
    expect(entry.defaultSize).toEqual({ w: 12, h: 9 });
  });

  it('falls back to a default title when the panel title is empty', () => {
    const items: WidgetLayoutItem[] = [
      { id: 'panel:d1:4', x: 0, y: 0, w: 12, h: 9, panel: { dashboardUid: 'd1', panelId: 4, title: '' } },
    ];

    const { result } = renderHook(() => usePanelWidgetEntries(items));

    expect(result.current[0].title).toBe('Dashboard panel');
  });
});
