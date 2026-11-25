import { act, renderHook } from '@testing-library/react';
import { type MouseEvent } from 'react';

import { disablePopoverMenu, enablePopoverMenu } from 'app/features/logs/utils';

import { useLogsTablePopoverMenu } from './useLogsTablePopoverMenu';

function mockSelection(text: string, commonAncestorContainer: Node | null) {
  jest.spyOn(document, 'getSelection').mockReturnValue({
    toString: () => text,
    rangeCount: commonAncestorContainer ? 1 : 0,
    getRangeAt: () => ({ commonAncestorContainer }),
  } as unknown as Selection);
}

function mouseEvent(overrides: Partial<MouseEvent<HTMLElement>> = {}) {
  return { clientX: 100, clientY: 50, altKey: false, ...overrides } as MouseEvent<HTMLElement>;
}

describe('useLogsTablePopoverMenu', () => {
  let container: HTMLDivElement;
  let cell: HTMLDivElement;
  const onClickFilterString = jest.fn();
  const onClickFilterOutString = jest.fn();

  beforeEach(() => {
    enablePopoverMenu();
    container = document.createElement('div');
    cell = document.createElement('div');
    cell.setAttribute('role', 'gridcell');
    cell.textContent = 'a log line';
    container.appendChild(cell);
    document.body.appendChild(container);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    container.remove();
    enablePopoverMenu();
  });

  function setup(handlers: { filter?: boolean; filterOut?: boolean } = { filter: true, filterOut: true }) {
    return renderHook(() =>
      useLogsTablePopoverMenu({
        containerElement: container,
        onClickFilterString: handlers.filter ? onClickFilterString : undefined,
        onClickFilterOutString: handlers.filterOut ? onClickFilterOutString : undefined,
      })
    );
  }

  it('opens the menu at the click position when text is selected inside a cell', () => {
    mockSelection('log', cell.firstChild);
    const { result } = setup();

    act(() => result.current.handleTextSelection(mouseEvent()));

    expect(result.current.popoverState).toEqual({ selection: 'log', coordinates: { x: 100, y: 50 } });
  });

  it('keeps the menu inside the viewport', () => {
    mockSelection('log', cell.firstChild);
    const { result } = setup();

    act(() =>
      result.current.handleTextSelection(mouseEvent({ clientX: window.innerWidth, clientY: window.innerHeight }))
    );

    expect(result.current.popoverState.coordinates.x).toBeLessThan(window.innerWidth);
    expect(result.current.popoverState.coordinates.y).toBeLessThan(window.innerHeight);
  });

  it('does not open the menu without a selection', () => {
    mockSelection('', cell.firstChild);
    const { result } = setup();

    act(() => result.current.handleTextSelection(mouseEvent()));

    expect(result.current.popoverState.selection).toBe('');
  });

  it('does not open the menu when the selection spans more than one cell', () => {
    mockSelection('log', container);
    const { result } = setup();

    act(() => result.current.handleTextSelection(mouseEvent()));

    expect(result.current.popoverState.selection).toBe('');
  });

  it('does not open the menu when no filter callbacks are available', () => {
    mockSelection('log', cell.firstChild);
    const { result } = setup({});

    act(() => result.current.handleTextSelection(mouseEvent()));

    expect(result.current.popoverState.selection).toBe('');
  });

  it('opens the menu with only one of the filter callbacks', () => {
    mockSelection('log', cell.firstChild);
    const { result } = setup({ filterOut: true });

    act(() => result.current.handleTextSelection(mouseEvent()));

    expect(result.current.popoverState.selection).toBe('log');
  });

  it('does not open the menu when it is disabled, unless alt is pressed', () => {
    disablePopoverMenu();
    mockSelection('log', cell.firstChild);
    const { result } = setup();

    act(() => result.current.handleTextSelection(mouseEvent()));
    expect(result.current.popoverState.selection).toBe('');

    act(() => result.current.handleTextSelection(mouseEvent({ altKey: true })));
    expect(result.current.popoverState.selection).toBe('log');
  });

  it('closes the menu on a click outside the table', () => {
    mockSelection('log', cell.firstChild);
    const { result } = setup();
    act(() => result.current.handleTextSelection(mouseEvent()));
    expect(result.current.popoverState.selection).toBe('log');

    act(() => {
      document.body.click();
    });

    expect(result.current.popoverState.selection).toBe('');
  });

  it('closes the menu on a click inside the table once the selection is cleared', () => {
    mockSelection('log', cell.firstChild);
    const { result } = setup();
    act(() => result.current.handleTextSelection(mouseEvent()));

    act(() => {
      cell.click();
    });
    expect(result.current.popoverState.selection).toBe('log');

    mockSelection('', cell.firstChild);
    act(() => {
      cell.click();
    });
    expect(result.current.popoverState.selection).toBe('');
  });

  it('requires confirmation to disable the menu', () => {
    mockSelection('log', cell.firstChild);
    const { result } = setup();
    act(() => result.current.handleTextSelection(mouseEvent()));

    act(() => result.current.onDisablePopoverMenu());
    expect(result.current.popoverState.selection).toBe('');
    expect(result.current.showDisablePopoverOptions).toBe(true);

    act(() => result.current.onDisableConfirm());
    expect(result.current.showDisablePopoverOptions).toBe(false);

    act(() => result.current.handleTextSelection(mouseEvent()));
    expect(result.current.popoverState.selection).toBe('');
  });
});
