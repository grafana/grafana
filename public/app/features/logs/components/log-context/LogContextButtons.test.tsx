import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { LogContextButtons } from './LogContextButtons';

describe('LogContextButtons', () => {
  it('should call onChangeWrapLines when the checkbox is used, case 1', async () => {
    const onChangeWrapLines = jest.fn();
    render(<LogContextButtons onChangeWrapLines={onChangeWrapLines} />);
    const wrapLinesBox = screen.getByRole('checkbox', {
      name: 'Wrap lines',
    });
    await userEvent.click(wrapLinesBox);
    expect(onChangeWrapLines).toHaveBeenCalledTimes(1);
    expect(onChangeWrapLines).toHaveBeenCalledWith(true);
  });

  it('should call onChangeWrapLines when the checkbox is used, case 2', async () => {
    const onChangeWrapLines = jest.fn();
    render(<LogContextButtons onChangeWrapLines={onChangeWrapLines} wrapLines />);
    const wrapLinesBox = screen.getByRole('checkbox', {
      name: 'Wrap lines',
    });
    await userEvent.click(wrapLinesBox);
    expect(onChangeWrapLines).toHaveBeenCalledTimes(1);
    expect(onChangeWrapLines).toHaveBeenCalledWith(false);
  });
});
