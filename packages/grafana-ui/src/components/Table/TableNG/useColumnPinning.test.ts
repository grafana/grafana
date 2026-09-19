import { act, renderHook } from '@testing-library/react';

import { useColumnPinning } from './useColumnPinning';

function setup(frozenColumns = 0) {
  const onColumnOrderChange = jest.fn();
  const props = {
    frameKey: 'frame-a',
    columns: ['A', 'B', 'C'],
    hiddenColumns: new Set<string>(),
    frozenColumns,
    enabled: true,
    onColumnOrderChange,
  };
  return { ...renderHook(useColumnPinning, { initialProps: props }), props, onColumnOrderChange };
}

it('writes a pinned prefix and preserves the authoritative order when unpinned', () => {
  const { result, rerender, props, onColumnOrderChange } = setup();
  act(() => result.current.togglePin('C'));
  expect(onColumnOrderChange).toHaveBeenLastCalledWith(['C', 'A', 'B']);
  rerender({ ...props, columns: ['C', 'A', 'B'] });
  expect(result.current.frozenColumns).toBe(1);
  act(() => result.current.togglePin('C'));
  expect(onColumnOrderChange).toHaveBeenLastCalledWith(['C', 'A', 'B']);
  expect(result.current.frozenColumns).toBe(0);
});

it('retains pin identity through hide, refresh and restore without freezing a replacement column', () => {
  const { result, rerender, props } = setup(1);
  act(() => result.current.togglePin('C'));
  rerender({ ...props, columns: ['A', 'C', 'B'], hiddenColumns: new Set(['C']) });
  expect(result.current.frozenColumns).toBe(1);
  expect([...result.current.pinnedColumns]).toEqual(['A', 'C']);
  rerender({ ...props, columns: ['A', 'C', 'B'] });
  expect(result.current.frozenColumns).toBe(2);
});

it('keeps independent pin state per frame and resets when the configured count changes', () => {
  const { result, rerender, props } = setup();
  act(() => result.current.togglePin('C'));
  rerender({ ...props, frameKey: 'frame-b' });
  expect(result.current.frozenColumns).toBe(0);
  rerender({ ...props, columns: ['C', 'A', 'B'] });
  expect([...result.current.pinnedColumns]).toEqual(['C']);
  rerender({ ...props, columns: ['C', 'A', 'B'], frozenColumns: 2 });
  expect([...result.current.pinnedColumns]).toEqual(['C', 'A']);
});

it('keeps pinned columns together when columns are dragged across the frozen boundary', () => {
  const { result, onColumnOrderChange } = setup(1);
  act(() => result.current.reorder(['B', 'C', 'A']));
  expect(onColumnOrderChange).toHaveBeenLastCalledWith(['A', 'B', 'C']);
  act(() => result.current.togglePin('A'));
  expect(onColumnOrderChange).toHaveBeenLastCalledWith(['A', 'B', 'C']);
});

it('preserves configured freezing and plain reordering when pinning is disabled', () => {
  const { result, rerender, props, onColumnOrderChange } = setup(1);
  rerender({ ...props, enabled: false });
  act(() => result.current.togglePin('C'));
  expect(result.current.frozenColumns).toBe(1);
  expect(onColumnOrderChange).not.toHaveBeenCalled();
  act(() => result.current.reorder(['C', 'A', 'B']));
  expect(onColumnOrderChange).toHaveBeenLastCalledWith(['C', 'A', 'B']);
});

it('uses externally restored order instead of pre-pin history', () => {
  const { result, rerender, props, onColumnOrderChange } = setup();
  act(() => result.current.togglePin('C'));
  rerender({ ...props, columns: ['C', 'B', 'A'] });
  act(() => result.current.togglePin('C'));
  expect(onColumnOrderChange).toHaveBeenLastCalledWith(['C', 'B', 'A']);
  expect(result.current.frozenColumns).toBe(0);
});
