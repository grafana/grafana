import { selectors } from '@grafana/e2e-selectors';
import userEvent from '@testing-library/user-event';
import { fireEvent, screen } from '@testing-library/react';

export const changeDatasource = async (name: string) => {
  const datasourcePicker = (await screen.findByLabelText(selectors.components.DataSourcePicker.container)).children[0];
  fireEvent.keyDown(datasourcePicker, { keyCode: 40 });
  const option = screen.getByText(name);
  fireEvent.click(option);
};

export const inputQuery = (query: string) => {
  const input = screen.getByRole('textbox', { name: 'query' });
  userEvent.type(input, query);
};

export const runQuery = () => {
  const button = screen.getByRole('button', { name: /run query/i });
  userEvent.click(button);
};

export const openQueryHistory = async () => {
  const button = screen.getByRole('button', { name: 'Rich history button' });
  userEvent.click(button);
  expect(
    await screen.findByText('The history is local to your browser and is not shared with others.')
  ).toBeInTheDocument();
};
