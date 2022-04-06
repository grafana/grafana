import { selectors } from '@grafana/e2e-selectors';
import userEvent from '@testing-library/user-event';
import { fireEvent, screen, within } from '@testing-library/react';
import { ExploreId } from '../../../../types';
import { withinExplore } from './setup';

export const changeDatasource = async (name: string) => {
  const datasourcePicker = (await screen.findByLabelText(selectors.components.DataSourcePicker.container)).children[0];
  fireEvent.keyDown(datasourcePicker, { keyCode: 40 });
  const option = screen.getByText(name);
  fireEvent.click(option);
};

export const inputQuery = async (query: string, exploreId: ExploreId = ExploreId.left) => {
  const input = withinExplore(exploreId).getByRole('textbox', { name: 'query' });
  await userEvent.clear(input);
  await userEvent.type(input, query);
};

export const runQuery = async (exploreId: ExploreId = ExploreId.left) => {
  const explore = withinExplore(exploreId);
  const toolbar = within(explore.getByLabelText('Explore toolbar'));
  const button = toolbar.getByRole('button', { name: /run query/i });
  await userEvent.click(button);
};

export const openQueryHistory = async (exploreId: ExploreId = ExploreId.left) => {
  const selector = withinExplore(exploreId);
  const button = selector.getByRole('button', { name: 'Rich history button' });
  await userEvent.click(button);
  expect(
    await selector.findByText('The history is local to your browser and is not shared with others.')
  ).toBeInTheDocument();
};

export const starQueryHistory = (queryIndex: number, exploreId: ExploreId = ExploreId.left) => {
  invokeAction(queryIndex, 'Star query', exploreId);
};

export const deleteQueryHistory = (queryIndex: number, exploreId: ExploreId = ExploreId.left) => {
  invokeAction(queryIndex, 'Delete query', exploreId);
};

const invokeAction = async (queryIndex: number, actionAccessibleName: string, exploreId: ExploreId) => {
  const selector = withinExplore(exploreId);
  const buttons = selector.getAllByRole('button', { name: actionAccessibleName });
  await userEvent.click(buttons[queryIndex]);
};
