import { act, renderHook } from '@testing-library/react';

import { VizPanel } from '@grafana/scenes';

import { QUICK_EDITS_RESET_DELAY_MS, usePanelQuickEditsView } from './panelQuickEditsView';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

// Mounting the hook stands in for the popover opening, unmounting for it closing.
function openPopover(panel: VizPanel) {
  return renderHook(() => usePanelQuickEditsView(panel));
}

it('keeps a panel on its quick edits when its popover reopens within the reset delay', () => {
  const panel = new VizPanel({ key: 'panel-1' });
  const first = openPopover(panel);
  act(() => first.result.current[1](true));
  first.unmount();

  act(() => jest.advanceTimersByTime(QUICK_EDITS_RESET_DELAY_MS - 1));
  const second = openPopover(panel);
  act(() => jest.advanceTimersByTime(QUICK_EDITS_RESET_DELAY_MS));

  expect(second.result.current[0]).toBe(true);
});

it('brings a panel back to its actions once its popover has been closed for the reset delay', () => {
  const panel = new VizPanel({ key: 'panel-1' });
  const first = openPopover(panel);
  act(() => first.result.current[1](true));
  first.unmount();

  act(() => jest.advanceTimersByTime(QUICK_EDITS_RESET_DELAY_MS));

  expect(openPopover(panel).result.current[0]).toBe(false);
});

it('keeps each panel on its own view', () => {
  const one = openPopover(new VizPanel({ key: 'panel-1' }));
  const two = openPopover(new VizPanel({ key: 'panel-2' }));

  act(() => one.result.current[1](true));

  expect(one.result.current[0]).toBe(true);
  expect(two.result.current[0]).toBe(false);
});

it("keeps a panel off another dashboard's panel with the same key", () => {
  const onFirstDashboard = openPopover(new VizPanel({ key: 'panel-1' }));
  act(() => onFirstDashboard.result.current[1](true));
  onFirstDashboard.unmount();

  expect(openPopover(new VizPanel({ key: 'panel-1' })).result.current[0]).toBe(false);
});
