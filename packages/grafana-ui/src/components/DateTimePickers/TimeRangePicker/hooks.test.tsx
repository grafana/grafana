import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { createRef, KeyboardEvent, RefObject } from 'react';

import { useListFocus } from './hooks';

describe('useListFocus', () => {
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
      <li data-role="item">Последние 7 дней</li>
    </ul>
  );
  const options = [
    { from: 'now-1h', to: 'now', display: 'Последний час' },
    { from: 'now-6h', to: 'now', display: 'Последние 6 часов' },
    { from: 'now-24h', to: 'now', display: 'Последние 24 часа' },
    { from: 'now-7d', to: 'now', display: 'Последние 7 дней' },
  ];

  it('sets correct focused item on keydown', () => {
    const ref = createRef<HTMLUListElement>();
    const { rerender } = render(getListElement(ref));

    const { result } = renderHook(() => useListFocus({ localRef: ref, options }));
    const [handleKeys] = result.current;
    rerender(getListElement(ref, handleKeys));

    expect(screen.getByText('Последний час').tabIndex).toBe(0);
    expect(screen.getByText('Последние 6 часов').tabIndex).toBe(-1);
    expect(screen.getByText('Последние 24 часа').tabIndex).toBe(-1);
    expect(screen.getByText('Последние 7 дней').tabIndex).toBe(-1);

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'ArrowDown' });
    });

    const [handleKeys2] = result.current;
    rerender(getListElement(ref, handleKeys2));

    expect(screen.getByText('Последний час').tabIndex).toBe(-1);
    expect(screen.getByText('Последние 6 часов').tabIndex).toBe(0);
    expect(screen.getByText('Последние 24 часа').tabIndex).toBe(-1);
    expect(screen.getByText('Последние 7 дней').tabIndex).toBe(-1);

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'ArrowDown' });
    });

    const [handleKeys3] = result.current;
    rerender(getListElement(ref, handleKeys3));

    expect(screen.getByText('Последний час').tabIndex).toBe(-1);
    expect(screen.getByText('Последние 6 часов').tabIndex).toBe(-1);
    expect(screen.getByText('Последние 24 часа').tabIndex).toBe(0);
    expect(screen.getByText('Последние 7 дней').tabIndex).toBe(-1);

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'ArrowUp' });
    });

    const [handleKeys4] = result.current;
    rerender(getListElement(ref, handleKeys4));

    expect(screen.getByText('Последний час').tabIndex).toBe(-1);
    expect(screen.getByText('Последние 6 часов').tabIndex).toBe(0);
    expect(screen.getByText('Последние 24 часа').tabIndex).toBe(-1);
    expect(screen.getByText('Последние 7 дней').tabIndex).toBe(-1);

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'ArrowUp' });
    });

    const [handleKeys5] = result.current;
    rerender(getListElement(ref, handleKeys5));

    expect(screen.getByText('Последний час').tabIndex).toBe(0);
    expect(screen.getByText('Последние 6 часов').tabIndex).toBe(-1);
    expect(screen.getByText('Последние 24 часа').tabIndex).toBe(-1);
    expect(screen.getByText('Последние 7 дней').tabIndex).toBe(-1);

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'ArrowUp' });
    });

    const [handleKeys6] = result.current;
    rerender(getListElement(ref, handleKeys6));

    expect(screen.getByText('Последний час').tabIndex).toBe(-1);
    expect(screen.getByText('Последние 6 часов').tabIndex).toBe(-1);
    expect(screen.getByText('Последние 24 часа').tabIndex).toBe(-1);
    expect(screen.getByText('Последние 7 дней').tabIndex).toBe(0);
  });

  it('clicks focused item when Enter key is pressed', () => {
    const ref = createRef<HTMLUListElement>();
    const onClick = jest.fn();
    const { rerender } = render(getListElement(ref));

    const { result } = renderHook(() => useListFocus({ localRef: ref, options }));
    const [handleKeys] = result.current;
    rerender(getListElement(ref, handleKeys, onClick));

    act(() => {
      fireEvent.keyDown(screen.getByTestId(testid), { key: 'Enter' });
    });

    expect(onClick).toHaveBeenCalled();
  });
});
