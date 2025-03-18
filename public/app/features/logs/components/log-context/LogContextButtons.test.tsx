import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LogContextButtons } from './LogContextButtons';

describe('LogContextButtons', () => {
  it('should call onChangeWrapLines when the switch is used, case 1', async () => {
    const onChangeWrapLines = jest.fn();
    render(<LogContextButtons onChangeWrapLines={onChangeWrapLines} onScrollCenterClick={jest.fn()} />);
    const wrapLinesBox = screen.getByRole('switch', {
      name: 'Wrap lines',
    });
    await userEvent.click(wrapLinesBox);
    expect(onChangeWrapLines).toHaveBeenCalledTimes(1);
    expect(onChangeWrapLines).toHaveBeenCalledWith(true);
  });

  it('should call onChangeWrapLines when the switch is used, case 2', async () => {
    const onChangeWrapLines = jest.fn();
    render(<LogContextButtons onChangeWrapLines={onChangeWrapLines} onScrollCenterClick={jest.fn()} wrapLines />);
    const wrapLinesBox = screen.getByRole('switch', {
      name: 'Wrap lines',
    });
    await userEvent.click(wrapLinesBox);
    expect(onChangeWrapLines).toHaveBeenCalledTimes(1);
    expect(onChangeWrapLines).toHaveBeenCalledWith(false);
  });

  it('should call onScrollCenterClick when the button is clicked', async () => {
    const onScrollCenterClick = jest.fn();
    render(<LogContextButtons onChangeWrapLines={jest.fn()} onScrollCenterClick={onScrollCenterClick} />);
    const scrollButton = screen.getByRole('button');
    await userEvent.click(scrollButton);
    expect(onScrollCenterClick).toHaveBeenCalledTimes(1);
  });
});
