import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import React, { createRef, KeyboardEvent, RefObject } from 'react';

import { useMenuFocus } from './hooks';

describe('useMenuFocus', () => {
  const testid = 'test';
  const getMenuElement = (
    ref: RefObject<HTMLDivElement>,
    handleKeys?: (event: KeyboardEvent) => void,
    handleFocus?: () => void,
    onClick?: () => void
  ) => (
    <div data-testid={testid} ref={ref} tabIndex={0} onKeyDown={handleKeys} onFocus={handleFocus}>
      <span data-role="menuitem" onClick={onClick}>
        Item 1
      </span>
      <span data-role="menuitem">Item 2</span>
      <span data-role="menuitem" data-disabled>
        Item 3
      </span>
      <span data-role="menuitem">Item 4</span>
    </div>
  );

  it('sets correct focused item on keydown', () => {
    const ref = createRef<HTMLDivElement>();
    const { result } = renderHook(() => useMenuFocus({ localRef: ref }));
    const [handleKeys] = result.current;
    const { rerender } = render(getMenuElement(ref, handleKeys));

    expect(screen.getByText('Item 1').tabIndex).toBe(-1);
    expect(screen.getByText('Item 2').tabIndex).toBe(-1);
    expect(screen.getByText('Item 3').tabIndex).toBe(-1);
    expect(screen.getByText('Item 4').tabIndex).toBe(-1);

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'ArrowDown' });
    });

    const [handleKeys2] = result.current;
    rerender(getMenuElement(ref, handleKeys2));

    expect(screen.getByText('Item 1').tabIndex).toBe(0);
    expect(screen.getByText('Item 2').tabIndex).toBe(-1);
    expect(screen.getByText('Item 3').tabIndex).toBe(-1);
    expect(screen.getByText('Item 4').tabIndex).toBe(-1);

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'ArrowDown' });
    });

    const [handleKeys3] = result.current;
    rerender(getMenuElement(ref, handleKeys3));

    expect(screen.getByText('Item 1').tabIndex).toBe(-1);
    expect(screen.getByText('Item 2').tabIndex).toBe(0);
    expect(screen.getByText('Item 3').tabIndex).toBe(-1);
    expect(screen.getByText('Item 4').tabIndex).toBe(-1);

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'ArrowUp' });
    });

    const [handleKeys4] = result.current;
    rerender(getMenuElement(ref, handleKeys4));

    expect(screen.getByText('Item 1').tabIndex).toBe(0);
    expect(screen.getByText('Item 2').tabIndex).toBe(-1);
    expect(screen.getByText('Item 3').tabIndex).toBe(-1);
    expect(screen.getByText('Item 4').tabIndex).toBe(-1);

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'ArrowUp' });
    });

    const [handleKeys5] = result.current;
    rerender(getMenuElement(ref, handleKeys5));

    expect(screen.getByText('Item 1').tabIndex).toBe(-1);
    expect(screen.getByText('Item 2').tabIndex).toBe(-1);
    expect(screen.getByText('Item 3').tabIndex).toBe(-1);
    expect(screen.getByText('Item 4').tabIndex).toBe(0);

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'ArrowUp' });
    });

    const [handleKeys6] = result.current;
    rerender(getMenuElement(ref, handleKeys6));

    expect(screen.getByText('Item 1').tabIndex).toBe(-1);
    expect(screen.getByText('Item 2').tabIndex).toBe(0);
    expect(screen.getByText('Item 3').tabIndex).toBe(-1);
    expect(screen.getByText('Item 4').tabIndex).toBe(-1);
  });

  it('calls close on ArrowLeft and unfocuses all items', () => {
    const ref = createRef<HTMLDivElement>();
    const close = jest.fn();
    const { result } = renderHook(() => useMenuFocus({ localRef: ref, close }));
    const [handleKeys] = result.current;
    const { rerender } = render(getMenuElement(ref, handleKeys));

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'ArrowDown' });
    });

    const [handleKeys2] = result.current;
    rerender(getMenuElement(ref, handleKeys2));

    expect(screen.getByText('Item 1').tabIndex).toBe(0);
    expect(screen.getByText('Item 2').tabIndex).toBe(-1);
    expect(screen.getByText('Item 3').tabIndex).toBe(-1);

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'ArrowLeft' });
    });

    expect(close).toHaveBeenCalled();
    expect(screen.getByText('Item 1').tabIndex).toBe(-1);
    expect(screen.getByText('Item 2').tabIndex).toBe(-1);
    expect(screen.getByText('Item 3').tabIndex).toBe(-1);
  });

  it('forwards keydown and open events', () => {
    const ref = createRef<HTMLDivElement>();
    const onOpen = jest.fn();
    const onKeyDown = jest.fn();
    const { result } = renderHook(() => useMenuFocus({ localRef: ref, onOpen, onKeyDown }));
    const [handleKeys] = result.current;

    render(getMenuElement(ref, handleKeys));

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'ArrowDown' });
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'Home' });
    });

    expect(onOpen).toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalledTimes(2);
  });

  it('focuses on first item when menu was opened with arrow', () => {
    const ref = createRef<HTMLDivElement>();

    render(getMenuElement(ref));

    const isMenuOpen = true;
    const openedWithArrow = true;
    const setOpenedWithArrow = jest.fn();
    renderHook(() => useMenuFocus({ localRef: ref, isMenuOpen, openedWithArrow, setOpenedWithArrow }));

    expect(screen.getByText('Item 1').tabIndex).toBe(0);
    expect(setOpenedWithArrow).toHaveBeenCalledWith(false);
  });

  it('clicks focused item when Enter key is pressed', () => {
    const ref = createRef<HTMLDivElement>();
    const onClick = jest.fn();
    const { result } = renderHook(() => useMenuFocus({ localRef: ref }));
    const [handleKeys] = result.current;
    const { rerender } = render(getMenuElement(ref, handleKeys, undefined, onClick));

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'ArrowDown' });
    });

    const [handleKeys2] = result.current;
    rerender(getMenuElement(ref, handleKeys2, undefined, onClick));

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'Enter' });
    });

    expect(onClick).toHaveBeenCalled();
  });

  it('calls onClose on Tab or Escape', () => {
    const ref = createRef<HTMLDivElement>();
    const onClose = jest.fn();
    const { result } = renderHook(() => useMenuFocus({ localRef: ref, onClose }));
    const [handleKeys] = result.current;

    render(getMenuElement(ref, handleKeys));

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'Tab' });
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'Escape' });
    });

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
