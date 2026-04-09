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
    const [isHidden, className, overlay, renderHidden] = result.current;

    expect(isHidden).toBe(false);
    expect(className).toBeUndefined();
    expect(overlay).toBeNull();
    expect(renderHidden).toBe(false);
  });

  test('when the group result is true, returns a visible tuple', () => {
    const group = buildConditionalRenderingGroup({ result: true });

    const { result } = renderHook(() => useIsConditionallyHidden(group));
    const [isHidden, className, overlay, renderHidden] = result.current;

    expect(isHidden).toBe(false);
    expect(className).toBeUndefined();
    expect(overlay).toBeNull();
    expect(renderHidden).toBe(false);
  });

  test('when the group result changes from true to false, updates the tuple to a hidden tuple', () => {
    const group = buildConditionalRenderingGroup({ result: true });

    const { result } = renderHook(() => useIsConditionallyHidden(group));
    let [isHidden, className, overlay, renderHidden] = result.current;

    expect(isHidden).toBe(false);
    expect(className).toBeUndefined();
    expect(overlay).toBeNull();
    expect(renderHidden).toBe(false);

    act(() => {
      group.setState({ result: false });
    });

    [isHidden, className, overlay, renderHidden] = result.current;

    expect(isHidden).toBe(true);
    expect(className).toBe('dashboard-visible-hidden-element');
    expect(overlay).toEqual(expect.objectContaining({ type: ConditionalRenderingOverlay }));
    expect(renderHidden).toBe(false);
  });

  test('when renderHidden is true, forwards it as the last tuple element', () => {
    const group = buildConditionalRenderingGroup({ renderHidden: true });

    const { result } = renderHook(() => useIsConditionallyHidden(group));
    const [isHidden, className, overlay, renderHidden] = result.current;

    expect(isHidden).toBe(false);
    expect(className).toBeUndefined();
    expect(overlay).toBeNull();
    expect(renderHidden).toBe(true);
  });

  test('when hidden and renderHidden is true, returns isHidden=true with renderHidden=true', () => {
    const group = buildConditionalRenderingGroup({ renderHidden: true });

    const { result } = renderHook(() => useIsConditionallyHidden(group));

    act(() => {
      group.setState({ result: false });
    });

    const [isHidden, className, overlay, renderHidden] = result.current;

    expect(isHidden).toBe(true);
    expect(className).toBe('dashboard-visible-hidden-element');
    expect(overlay).toEqual(expect.objectContaining({ type: ConditionalRenderingOverlay }));
    expect(renderHidden).toBe(true);
  });
});
