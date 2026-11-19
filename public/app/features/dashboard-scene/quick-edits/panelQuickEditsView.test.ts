import { act, renderHook } from '@testing-library/react';

import { QUICK_EDITS_RESET_DELAY_MS, usePanelQuickEditsView } from './panelQuickEditsView';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

// Mounting the hook stands in for the popover opening, unmounting for it closing.
function openPopover(key: string) {
  return renderHook(() => usePanelQuickEditsView(key));
}

it('keeps a panel on its quick edits when its popover reopens within the reset delay', () => {
  const first = openPopover('panel-reopened');
  act(() => first.result.current[1](true));
  first.unmount();

  act(() => jest.advanceTimersByTime(QUICK_EDITS_RESET_DELAY_MS - 1));
  const second = openPopover('panel-reopened');
  act(() => jest.advanceTimersByTime(QUICK_EDITS_RESET_DELAY_MS));

  expect(second.result.current[0]).toBe(true);
});

it('brings a panel back to its actions once its popover has been closed for the reset delay', () => {
  const first = openPopover('panel-left');
  act(() => first.result.current[1](true));
  first.unmount();

  act(() => jest.advanceTimersByTime(QUICK_EDITS_RESET_DELAY_MS));

  expect(openPopover('panel-left').result.current[0]).toBe(false);
});

it('keeps each panel on its own view', () => {
  const one = openPopover('panel-one');
  const two = openPopover('panel-two');

  act(() => one.result.current[1](true));

  expect(one.result.current[0]).toBe(true);
  expect(two.result.current[0]).toBe(false);
});
