import { SeriesVisibilityChangeMode } from '../PanelChrome/types';

import { mapMouseEventToMode } from './utils';

function mouseEvent(overrides: Partial<React.MouseEvent> = {}) {
  return { ctrlKey: false, metaKey: false, shiftKey: false, ...overrides } as React.MouseEvent;
}

describe('mapMouseEventToMode', () => {
  it('returns ToggleSelection for plain click', () => {
    expect(mapMouseEventToMode(mouseEvent())).toBe(SeriesVisibilityChangeMode.ToggleSelection);
  });

  it.each([{ key: 'ctrlKey' as const }, { key: 'metaKey' as const }, { key: 'shiftKey' as const }])(
    'returns AppendToSelection when $key is held',
    ({ key }) => {
      expect(mapMouseEventToMode(mouseEvent({ [key]: true }))).toBe(SeriesVisibilityChangeMode.AppendToSelection);
    }
  );
});
