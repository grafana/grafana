import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, KeyboardEvent, RefObject } from 'react';

import { useListFocus } from './hooks';

describe('useListFocus', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  const testid = 'test';
  const getListElement = (
    ref: RefObject<HTMLUListElement>,
    handleKeys?: (event: KeyboardEvent) => void,
    onClick?: () => void
  ) => (
    <ul data-testid={testid} ref={ref} tabIndex={0} onKeyDown={handleKeys}>
      <li data-role="item" onClick={onClick}>
        Last 1 hour
      </li>
      <li data-role="item">Last 6 hours</li>
      <li data-role="item">Last 24 hours</li>
      <li data-role="item">Last 7 days</li>
    </ul>
  );
  const options = [
    { from: 'now-1h', to: 'now', display: 'Last 1 hour' },
    { from: 'now-6h', to: 'now', display: 'Last 6 hours' },
    { from: 'now-24h', to: 'now', display: 'Last 24 hours' },
    { from: 'now-7d', to: 'now', display: 'Last 7 days' },
  ];

  it('sets correct focused item on keydown', async () => {
    const ref = createRef<HTMLUListElement>();
    const { rerender } = render(getListElement(ref));

    const { result } = renderHook(() => useListFocus({ localRef: ref, options }));
    const [handleKeys] = result.current;
    rerender(getListElement(ref, handleKeys));

    expect(screen.getByText('Last 1 hour').tabIndex).toBe(0);
    expect(screen.getByText('Last 6 hours').tabIndex).toBe(-1);
    expect(screen.getByText('Last 24 hours').tabIndex).toBe(-1);
    expect(screen.getByText('Last 7 days').tabIndex).toBe(-1);
    await user.type(screen.getByTestId(testid), '{ArrowDown}');

    const [handleKeys2] = result.current;
    rerender(getListElement(ref, handleKeys2));

    expect(screen.getByText('Last 1 hour').tabIndex).toBe(-1);
    expect(screen.getByText('Last 6 hours').tabIndex).toBe(0);
    expect(screen.getByText('Last 24 hours').tabIndex).toBe(-1);
    expect(screen.getByText('Last 7 days').tabIndex).toBe(-1);

    await user.type(screen.getByTestId(testid), '{ArrowDown}');

    const [handleKeys3] = result.current;
    rerender(getListElement(ref, handleKeys3));

    expect(screen.getByText('Last 1 hour').tabIndex).toBe(-1);
    expect(screen.getByText('Last 6 hours').tabIndex).toBe(-1);
    expect(screen.getByText('Last 24 hours').tabIndex).toBe(0);
    expect(screen.getByText('Last 7 days').tabIndex).toBe(-1);

    await user.type(screen.getByTestId(testid), '{ArrowUp}');

    const [handleKeys4] = result.current;
    rerender(getListElement(ref, handleKeys4));

    expect(screen.getByText('Last 1 hour').tabIndex).toBe(-1);
    expect(screen.getByText('Last 6 hours').tabIndex).toBe(0);
    expect(screen.getByText('Last 24 hours').tabIndex).toBe(-1);
    expect(screen.getByText('Last 7 days').tabIndex).toBe(-1);

    await user.type(screen.getByTestId(testid), '{ArrowUp}');

    const [handleKeys5] = result.current;
    rerender(getListElement(ref, handleKeys5));

    expect(screen.getByText('Last 1 hour').tabIndex).toBe(0);
    expect(screen.getByText('Last 6 hours').tabIndex).toBe(-1);
    expect(screen.getByText('Last 24 hours').tabIndex).toBe(-1);
    expect(screen.getByText('Last 7 days').tabIndex).toBe(-1);

    await user.type(screen.getByTestId(testid), '{ArrowUp}');

    const [handleKeys6] = result.current;
    rerender(getListElement(ref, handleKeys6));

    expect(screen.getByText('Last 1 hour').tabIndex).toBe(-1);
    expect(screen.getByText('Last 6 hours').tabIndex).toBe(-1);
    expect(screen.getByText('Last 24 hours').tabIndex).toBe(-1);
    expect(screen.getByText('Last 7 days').tabIndex).toBe(0);
  });

  it('clicks focused item when Enter key is pressed', async () => {
    const ref = createRef<HTMLUListElement>();
    const onClick = jest.fn();
    const { rerender } = render(getListElement(ref));

    const { result } = renderHook(() => useListFocus({ localRef: ref, options }));
    const [handleKeys] = result.current;
    rerender(getListElement(ref, handleKeys, onClick));

    await user.type(screen.getByTestId(testid), '{Enter}');

    expect(onClick).toHaveBeenCalled();
  });
});
