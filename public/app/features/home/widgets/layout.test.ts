import { type Layout } from 'react-grid-layout';

import { mergeItemPositions } from './layout';
import { type WidgetLayoutItem } from './types';

describe('mergeItemPositions', () => {
  it('updates a pinned-panel item position while preserving its panel ref', () => {
    const items: WidgetLayoutItem[] = [
      { id: 'panel:d1:3', x: 0, y: 0, w: 12, h: 9, panel: { dashboardUid: 'd1', panelId: 3, title: 'CPU' } },
    ];
    const rglLayout: Layout[] = [{ i: 'panel:d1:3', x: 6, y: 2, w: 10, h: 7 }];

    const result = mergeItemPositions(items, rglLayout);

    expect(result[0]).toEqual({
      id: 'panel:d1:3',
      x: 6,
      y: 2,
      w: 10,
      h: 7,
      panel: { dashboardUid: 'd1', panelId: 3, title: 'CPU' },
    });
  });

  it('returns items absent from the RGL layout untouched', () => {
    const alerts: WidgetLayoutItem = { id: 'alerts', x: 0, y: 9, w: 12, h: 8 };
    const items: WidgetLayoutItem[] = [{ id: 'quicklinks', x: 0, y: 0, w: 12, h: 4 }, alerts];
    const rglLayout: Layout[] = [{ i: 'quicklinks', x: 3, y: 1, w: 8, h: 5 }];

    const result = mergeItemPositions(items, rglLayout);

    expect(result.find((item) => item.id === 'alerts')).toEqual(alerts);
  });

  it('updates a non-panel item position from its RGL entry', () => {
    const items: WidgetLayoutItem[] = [{ id: 'quicklinks', x: 0, y: 0, w: 12, h: 4 }];
    const rglLayout: Layout[] = [{ i: 'quicklinks', x: 4, y: 6, w: 6, h: 3 }];

    const result = mergeItemPositions(items, rglLayout);

    expect(result[0]).toEqual({ id: 'quicklinks', x: 4, y: 6, w: 6, h: 3 });
  });
});
