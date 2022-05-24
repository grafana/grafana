import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

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
  expect(await selector.findByPlaceholderText('Search queries')).toBeInTheDocument();
};

export const closeQueryHistory = async (exploreId: ExploreId = ExploreId.left) => {
  const closeButton = withinExplore(exploreId).getByRole('button', { name: 'Close query history' });
  await userEvent.click(closeButton);
};

export const switchToQueryHistoryTab = async (
  name: 'Settings' | 'Query History',
  exploreId: ExploreId = ExploreId.left
) => {
  await userEvent.click(withinExplore(exploreId).getByRole('tab', { name: `Tab ${name}` }));
};

export const selectStarredTabFirst = async (exploreId: ExploreId = ExploreId.left) => {
  const checkbox = withinExplore(exploreId).getByRole('checkbox', {
    name: 'Change the default active tab from “Query history” to “Starred”',
  });
  await userEvent.click(checkbox);
};

export const selectOnlyActiveDataSource = async (exploreId: ExploreId = ExploreId.left) => {
  const checkbox = withinExplore(exploreId).getByLabelText(/Only show queries for data source currently active.*/);
  await userEvent.click(checkbox);
};

export const starQueryHistory = (queryIndex: number, exploreId: ExploreId = ExploreId.left) => {
  invokeAction(queryIndex, 'Star query', exploreId);
};

export const deleteQueryHistory = (queryIndex: number, exploreId: ExploreId = ExploreId.left) => {
  invokeAction(queryIndex, 'Delete query', exploreId);
};

export const loadMoreQueryHistory = async (exploreId: ExploreId = ExploreId.left) => {
  const button = withinExplore(exploreId).getByRole('button', { name: 'Load more' });
  await userEvent.click(button);
};

const invokeAction = async (queryIndex: number, actionAccessibleName: string, exploreId: ExploreId) => {
  const selector = withinExplore(exploreId);
  const buttons = selector.getAllByRole('button', { name: actionAccessibleName });
  await userEvent.click(buttons[queryIndex]);
};
