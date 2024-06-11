import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { createLogRow } from '../../logs/components/__mocks__/logRow';

import { PopoverMenu } from './PopoverMenu';

const row = createLogRow();

test('Does not render if the filter functions are not defined', () => {
  render(<PopoverMenu selection="test" x={0} y={0} row={row} close={() => {}} />);

  expect(screen.queryByText('Copy selection')).not.toBeInTheDocument();
});

test('Renders copy and line contains filter', async () => {
  const onClickFilterString = jest.fn();
  render(
    <PopoverMenu selection="test" x={0} y={0} row={row} close={() => {}} onClickFilterString={onClickFilterString} />
  );

  expect(screen.getByText('Copy selection')).toBeInTheDocument();
  expect(screen.getByText('Add as line contains filter')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Add as line contains filter'));

  expect(onClickFilterString).toHaveBeenCalledTimes(1);
  expect(onClickFilterString).toHaveBeenCalledWith('test', row.dataFrame.refId);
});

test('Renders copy and line does not contain filter', async () => {
  const onClickFilterOutString = jest.fn();
  render(
    <PopoverMenu
      selection="test"
      x={0}
      y={0}
      row={row}
      close={() => {}}
      onClickFilterOutString={onClickFilterOutString}
    />
  );

  expect(screen.getByText('Copy selection')).toBeInTheDocument();
  expect(screen.getByText('Add as line does not contain filter')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Add as line does not contain filter'));

  expect(onClickFilterOutString).toHaveBeenCalledTimes(1);
  expect(onClickFilterOutString).toHaveBeenCalledWith('test', row.dataFrame.refId);
});

test('Renders copy, line contains filter, and line does not contain filter', () => {
  render(
    <PopoverMenu
      selection="test"
      x={0}
      y={0}
      row={row}
      close={() => {}}
      onClickFilterString={() => {}}
      onClickFilterOutString={() => {}}
    />
  );

  expect(screen.getByText('Copy selection')).toBeInTheDocument();
  expect(screen.getByText('Add as line contains filter')).toBeInTheDocument();
  expect(screen.getByText('Add as line does not contain filter')).toBeInTheDocument();
});

test('Can be dismissed with escape', async () => {
  const close = jest.fn();
  render(
    <PopoverMenu
      selection="test"
      x={0}
      y={0}
      row={row}
      close={close}
      onClickFilterString={() => {}}
      onClickFilterOutString={() => {}}
    />
  );

  expect(close).not.toHaveBeenCalled();
  expect(screen.getByText('Copy selection')).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(close).toHaveBeenCalledTimes(1);
});
