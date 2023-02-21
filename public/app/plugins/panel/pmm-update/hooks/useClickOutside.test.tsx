/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent } from '@testing-library/react';
import React, { createRef, FC } from 'react';

import { useClickOutside } from './useClickOutside';

const HookWrapper: FC<{ hook: () => any }> = ({ hook }) => {
  const dataHook = hook ? hook() : undefined;

  return <div data-hook={dataHook} />;
};

describe('useClickOutside', () => {
  it('should call the passed handler when clicked outside the passed ref or if Esc is pressed', async () => {
    const mockedHandler = jest.fn();
    const parent = document.createElement('div');
    const ref = createRef<HTMLDivElement>();

    document.body.appendChild(parent);

    render(<div data-testid="referred" ref={ref} />, { container: parent });
    render(<HookWrapper hook={() => useClickOutside(ref, mockedHandler)} />);

    const referredElement = screen.getByTestId('referred');

    fireEvent.click(referredElement);
    expect(mockedHandler).not.toBeCalled();

    fireEvent.click(parent);
    expect(mockedHandler).toBeCalledTimes(1);

    fireEvent.keyDown(referredElement, { key: 'Escape' });
    expect(mockedHandler).toBeCalledTimes(2);

    fireEvent.keyDown(referredElement, { key: 'Escape' });
    expect(mockedHandler).toBeCalledTimes(3);

    fireEvent.keyDown(parent, { key: 'A' });
    expect(mockedHandler).toBeCalledTimes(3);

    fireEvent.keyDown(parent, { key: 'A' });
    expect(mockedHandler).toBeCalledTimes(3);
  });
});
