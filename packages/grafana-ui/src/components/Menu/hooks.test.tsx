import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, KeyboardEvent, RefObject } from 'react';

import { useMenuFocus } from './hooks';

describe('useMenuFocus', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

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

  it('sets correct focused item on keydown', async () => {
    const ref = createRef<HTMLDivElement>();
    const { result } = renderHook(() => useMenuFocus({ localRef: ref }));
    const [handleKeys] = result.current;
    const { rerender } = render(getMenuElement(ref, handleKeys));

    expect(screen.getByText('Item 1').tabIndex).toBe(-1);
    expect(screen.getByText('Item 2').tabIndex).toBe(-1);
    expect(screen.getByText('Item 3').tabIndex).toBe(-1);
    expect(screen.getByText('Item 4').tabIndex).toBe(-1);

    await user.type(screen.getByTestId(testid), '{ArrowDown}');

    const [handleKeys2] = result.current;
    rerender(getMenuElement(ref, handleKeys2));

    expect(screen.getByText('Item 1').tabIndex).toBe(0);
    expect(screen.getByText('Item 2').tabIndex).toBe(-1);
    expect(screen.getByText('Item 3').tabIndex).toBe(-1);
    expect(screen.getByText('Item 4').tabIndex).toBe(-1);

    await user.type(screen.getByTestId(testid), '{ArrowDown}');

    const [handleKeys3] = result.current;
    rerender(getMenuElement(ref, handleKeys3));

    expect(screen.getByText('Item 1').tabIndex).toBe(-1);
    expect(screen.getByText('Item 2').tabIndex).toBe(0);
    expect(screen.getByText('Item 3').tabIndex).toBe(-1);
    expect(screen.getByText('Item 4').tabIndex).toBe(-1);

    await user.type(screen.getByTestId(testid), '{ArrowUp}');

    const [handleKeys4] = result.current;
    rerender(getMenuElement(ref, handleKeys4));

    expect(screen.getByText('Item 1').tabIndex).toBe(0);
    expect(screen.getByText('Item 2').tabIndex).toBe(-1);
    expect(screen.getByText('Item 3').tabIndex).toBe(-1);
    expect(screen.getByText('Item 4').tabIndex).toBe(-1);

    await user.type(screen.getByTestId(testid), '{ArrowUp}');

    const [handleKeys5] = result.current;
    rerender(getMenuElement(ref, handleKeys5));

    expect(screen.getByText('Item 1').tabIndex).toBe(-1);
    expect(screen.getByText('Item 2').tabIndex).toBe(-1);
    expect(screen.getByText('Item 3').tabIndex).toBe(-1);
    expect(screen.getByText('Item 4').tabIndex).toBe(0);

    await user.type(screen.getByTestId(testid), '{ArrowUp}');

    const [handleKeys6] = result.current;
    rerender(getMenuElement(ref, handleKeys6));

    expect(screen.getByText('Item 1').tabIndex).toBe(-1);
    expect(screen.getByText('Item 2').tabIndex).toBe(0);
    expect(screen.getByText('Item 3').tabIndex).toBe(-1);
    expect(screen.getByText('Item 4').tabIndex).toBe(-1);
  });

  it('calls close on ArrowLeft and unfocuses all items', async () => {
    const ref = createRef<HTMLDivElement>();
    const close = jest.fn();
    const { result } = renderHook(() => useMenuFocus({ localRef: ref, close }));
    const [handleKeys] = result.current;
    const { rerender } = render(getMenuElement(ref, handleKeys));

    await user.type(screen.getByTestId(testid), '{ArrowDown}');

    const [handleKeys2] = result.current;
    rerender(getMenuElement(ref, handleKeys2));

    expect(screen.getByText('Item 1').tabIndex).toBe(0);
    expect(screen.getByText('Item 2').tabIndex).toBe(-1);
    expect(screen.getByText('Item 3').tabIndex).toBe(-1);

    await user.type(screen.getByTestId(testid), '{ArrowLeft}');

    expect(close).toHaveBeenCalled();
    expect(screen.getByText('Item 1').tabIndex).toBe(-1);
    expect(screen.getByText('Item 2').tabIndex).toBe(-1);
    expect(screen.getByText('Item 3').tabIndex).toBe(-1);
  });

  it('forwards keydown and open events', async () => {
    const ref = createRef<HTMLDivElement>();
    const onOpen = jest.fn();
    const onKeyDown = jest.fn();
    const { result } = renderHook(() => useMenuFocus({ localRef: ref, onOpen, onKeyDown }));
    const [handleKeys] = result.current;

    render(getMenuElement(ref, handleKeys));

    await user.type(screen.getByTestId(testid), '{ArrowDown}{Home}');

    expect(onOpen).toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalledTimes(2);
  });

  it('focuses on first item', () => {
    const ref = createRef<HTMLDivElement>();

    render(getMenuElement(ref));

    const isMenuOpen = true;
    renderHook(() => useMenuFocus({ localRef: ref, isMenuOpen }));

    expect(screen.getByText('Item 1').tabIndex).toBe(0);
  });

  it('clicks focused item when Enter key is pressed', async () => {
    const ref = createRef<HTMLDivElement>();
    const onClick = jest.fn();
    const { result } = renderHook(() => useMenuFocus({ localRef: ref }));
    const [handleKeys] = result.current;
    const { rerender } = render(getMenuElement(ref, handleKeys, undefined, onClick));

    await user.type(screen.getByTestId(testid), '{ArrowDown}');

    const [handleKeys2] = result.current;
    rerender(getMenuElement(ref, handleKeys2, undefined, onClick));

    await user.type(screen.getByTestId(testid), '{Enter}');

    expect(onClick).toHaveBeenCalled();
  });

  it('calls onClose on Tab or Escape', async () => {
    const ref = createRef<HTMLDivElement>();
    const onClose = jest.fn();
    const { result } = renderHook(() => useMenuFocus({ localRef: ref, onClose }));
    const [handleKeys] = result.current;

    render(getMenuElement(ref, handleKeys));

    await user.type(screen.getByTestId(testid), '{Tab}{Escape}');

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
