import { renderHook } from '@testing-library/react';

import { VizPanel } from '@grafana/scenes';

import { usePanelContext } from '../QueryEditorContext';

import { usePanelScopedVars } from './usePanelScopedVars';

jest.mock('../QueryEditorContext', () => ({
  usePanelContext: jest.fn(),
}));

const mockUsePanelContext = jest.mocked(usePanelContext);

describe('usePanelScopedVars', () => {
  it('returns scoped vars whose __sceneObject resolves to the panel from context', () => {
    const panel = new VizPanel({ key: 'panel-1' });
    mockUsePanelContext.mockReturnValue({ panel, transformations: [] });

    const { result } = renderHook(() => usePanelScopedVars());

    // Unwrapping the scene object must yield the same panel, so datasource interpolation walks that
    // panel's local scope (row/tab section-scoped variables), not just dashboard-level variables.
    expect(result.current.__sceneObject?.value.valueOf()).toBe(panel);
  });
});
