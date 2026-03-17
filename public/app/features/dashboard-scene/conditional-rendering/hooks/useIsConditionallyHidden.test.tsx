import { act, renderHook } from '@testing-library/react';

import { ConditionalRenderingGroup } from '../group/ConditionalRenderingGroup';

import { ConditionalRenderingOverlay } from './ConditionalRenderingOverlay';
import { useIsConditionallyHidden } from './useIsConditionallyHidden';

function buildConditionalRenderingGroup({
  result = true,
  renderHidden = false,
}: { result?: boolean; renderHidden?: boolean } = {}): ConditionalRenderingGroup {
  return new ConditionalRenderingGroup({
    condition: 'and',
    visibility: 'show',
    conditions: [],
    result,
    renderHidden,
  });
}

describe('useIsConditionallyHidden', () => {
  test('when no conditionalRendering is provided, defaults to a visible tuple', () => {
    const { result } = renderHook(() => useIsConditionallyHidden());

    expect(result.current).toEqual([false, undefined, null, false]);
  });

  test('when the group result is true, returns a visible tuple', () => {
    const group = buildConditionalRenderingGroup({ result: true });

    const { result } = renderHook(() => useIsConditionallyHidden(group));

    expect(result.current).toEqual([false, undefined, null, false]);
  });

  test('when the group result changes from true to false, updates the tuple to a hidden tuple', () => {
    const group = buildConditionalRenderingGroup({ result: true });

    const { result } = renderHook(() => useIsConditionallyHidden(group));

    expect(result.current).toEqual([false, undefined, null, false]);

    act(() => {
      group.setState({ result: false });
    });

    expect(result.current).toEqual([
      true,
      'dashboard-visible-hidden-element',
      expect.objectContaining({ type: ConditionalRenderingOverlay }),
      false,
    ]);
  });

  test('when renderHidden is true, forwards it as the last tuple element', () => {
    const group = buildConditionalRenderingGroup({ renderHidden: true });

    const { result } = renderHook(() => useIsConditionallyHidden(group));

    expect(result.current.at(-1)).toBe(true);
  });

  test('when hidden and renderHidden is true, returns isHidden=true with renderHidden=true', () => {
    const group = buildConditionalRenderingGroup({ renderHidden: true });

    const { result } = renderHook(() => useIsConditionallyHidden(group));

    act(() => {
      group.setState({ result: false });
    });

    expect(result.current).toEqual([
      true,
      'dashboard-visible-hidden-element',
      expect.objectContaining({ type: ConditionalRenderingOverlay }),
      true,
    ]);
  });
});
