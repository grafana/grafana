import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { getAllByRoleInQueryHistoryTab, withinExplore, withinQueryHistory } from './setup';

export const changeDatasource = async (name: string) => {
  const datasourcePicker = (await screen.findByTestId(selectors.components.DataSourcePicker.container)).children[0];
  await userEvent.click(datasourcePicker);
  const option = within(screen.getByTestId(selectors.components.DataSourcePicker.dataSourceList)).getAllByText(name)[0];
  await userEvent.click(option);
};

export const inputQuery = async (query: string, exploreId = 'left') => {
  const input = withinExplore(exploreId).getByRole('textbox', { name: 'query' });
  await userEvent.clear(input);
  await userEvent.type(input, query);
};

export const runQuery = async (exploreId = 'left') => {
  const explore = withinExplore(exploreId);
  const toolbar = within(explore.getByLabelText('Explore toolbar'));
  const button = toolbar.getByRole('button', { name: /run query/i });
  await userEvent.click(button);
};

export const openQueryHistory = async () => {
  const explore = withinExplore('left');
  const button = explore.getByRole('button', { name: 'Query history' });
  await userEvent.click(button);
  expect(await screen.findByPlaceholderText('Search queries')).toBeInTheDocument();
};

export const openQueryLibrary = async () => {
  const explore = withinExplore('left');
  const button = explore.getByRole('button', { name: 'Query library' });
  await userEvent.click(button);
  await waitFor(async () => {
    screen.getByRole('tab', {
      name: /query library/i,
    });
  });
};

export const switchToQueryHistory = async () => {
  const tab = screen.getByRole('tab', {
    name: /query history/i,
  });
  await userEvent.click(tab);
};

export const addQueryHistoryToQueryLibrary = async () => {
  const button = withinQueryHistory().getByRole('button', { name: /add to library/i });
  await userEvent.click(button);
};

export const submitAddToQueryLibrary = async ({ description }: { description: string }) => {
  const input = within(screen.getByRole('dialog')).getByLabelText('Description');
  await userEvent.type(input, description);
  const saveButton = screen.getByRole('button', {
    name: /^save$/i,
  });
  await userEvent.click(saveButton);
};

export const closeQueryHistory = async () => {
  const selector = withinQueryHistory();
  const closeButton = selector.getByRole('button', { name: 'Close query history' });
  await userEvent.click(closeButton);
};

export const switchToQueryHistoryTab = async (name: 'Settings' | 'Query History') => {
  await userEvent.click(withinQueryHistory().getByRole('tab', { name }));
};

export const selectStarredTabFirst = async () => {
  const checkbox = withinQueryHistory().getByRole('checkbox', {
    name: /Change the default active tab from “Query history” to “Starred”/,
  });
  await userEvent.click(checkbox);
};

export const selectOnlyActiveDataSource = async () => {
  const checkbox = withinQueryHistory().getByLabelText(/Only show queries for data source currently active.*/);
  await userEvent.click(checkbox);
};

export const starQueryHistory = async (queryIndex: number) => {
  await invokeAction(queryIndex, 'Star query');
};

export const commentQueryHistory = async (queryIndex: number, comment: string) => {
  await invokeAction(queryIndex, 'Add comment');
  const input = withinQueryHistory().getByPlaceholderText('An optional description of what the query does.');
  await userEvent.clear(input);
  await userEvent.type(input, comment);
  await invokeAction(queryIndex, 'Save comment');
};

export const deleteQueryHistory = async (queryIndex: number) => {
  await invokeAction(queryIndex, 'Delete query');
};

export const loadMoreQueryHistory = async () => {
  const button = withinQueryHistory().getByRole('button', { name: 'Load more' });
  await userEvent.click(button);
};

const invokeAction = async (queryIndex: number, actionAccessibleName: string | RegExp) => {
  const buttons = getAllByRoleInQueryHistoryTab('button', actionAccessibleName);
  await userEvent.click(buttons[queryIndex]);
};
