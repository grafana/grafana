/* eslint-disable @typescript-eslint/no-explicit-any */

import { render, screen, fireEvent } from '@testing-library/react';
import React, { FC } from 'react';

import { useToggleOnAltClick } from './useToggleOnAltClick';

const HookWrapper: FC = () => {
  const [toggleValue, handler] = useToggleOnAltClick();

  return (
    <>
      {toggleValue && <span data-testid="hook-wrapper-toggle" />}
      <button data-testid="hook-wrapper-handler" onClick={handler} />
    </>
  );
};

describe('useToggleOnAltClick', () => {
  it('should toggle a boolean value on alt+click on a compunent using the returned handler', async () => {
    render(<HookWrapper />);

    expect(screen.queryByTestId('hook-wrapper-toggle')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hook-wrapper-handler'), { altKey: true });

    expect(screen.queryByTestId('hook-wrapper-toggle')).toBeInTheDocument();
  });

  it('should do nothing if alt is not pressed while clicking', async () => {
    render(<HookWrapper />);

    expect(screen.queryByTestId('hook-wrapper-toggle')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hook-wrapper-handler'), { altKey: false });

    expect(screen.queryByTestId('hook-wrapper-toggle')).not.toBeInTheDocument();
  });
});
