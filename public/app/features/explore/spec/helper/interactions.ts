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

export const inputQuery = (query: string, exploreId: ExploreId = ExploreId.left) => {
  const input = withinExplore(exploreId).getByRole('textbox', { name: 'query' });
  userEvent.clear(input);
  userEvent.type(input, query);
};

export const runQuery = (exploreId: ExploreId = ExploreId.left) => {
  const explore = withinExplore(exploreId);
  const toolbar = within(explore.getByLabelText('Explore toolbar'));
  const button = toolbar.getByRole('button', { name: /run query/i });
  userEvent.click(button);
};

export const openQueryHistory = async (exploreId: ExploreId = ExploreId.left) => {
  const selector = withinExplore(exploreId);
  const button = selector.getByRole('button', { name: 'Rich history button' });
  userEvent.click(button);
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

const invokeAction = (queryIndex: number, actionAccessibleName: string, exploreId: ExploreId) => {
  const selector = withinExplore(exploreId);
  const buttons = selector.getAllByRole('button', { name: actionAccessibleName });
  userEvent.click(buttons[queryIndex]);
};
