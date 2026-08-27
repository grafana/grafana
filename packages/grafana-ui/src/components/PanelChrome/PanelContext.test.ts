import { renderHook } from '@testing-library/react';

import { usePanelContext } from './PanelContext';

describe('usePanelContext', () => {
  // Hosts that render no PanelContextProvider at all — PanelRenderer, and so Explore, alerting
  // rule previews and the visualization suggestion cards — fall back to this default. A panel
  // feature-detects on the absence to decide whether to render an affordance that writes a
  // transformation, so the members have to be missing here, not stubbed.
  it('leaves the transformation members undefined when no provider is mounted', () => {
    const { result } = renderHook(() => usePanelContext());

    expect(result.current.transformations).toBeUndefined();
    expect(result.current.onTransformationsChange).toBeUndefined();
  });
});
