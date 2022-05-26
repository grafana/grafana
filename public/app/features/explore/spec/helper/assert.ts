import { waitFor } from '@testing-library/react';

import { ExploreId } from '../../../../types';

import { withinExplore } from './setup';

export const assertQueryHistoryExists = async (query: string, exploreId: ExploreId = ExploreId.left) => {
  const selector = withinExplore(exploreId);

  expect(await selector.findByText('1 queries')).toBeInTheDocument();
  const queryItem = selector.getByLabelText('Query text');
  expect(queryItem).toHaveTextContent(query);
};

export const assertQueryHistory = async (expectedQueryTexts: string[], exploreId: ExploreId = ExploreId.left) => {
  const selector = withinExplore(exploreId);
  await waitFor(() => {
    expect(selector.getByText(new RegExp(`${expectedQueryTexts.length} queries`))).toBeInTheDocument();
    const queryTexts = selector.getAllByLabelText('Query text');
    expectedQueryTexts.forEach((expectedQueryText, queryIndex) => {
      expect(queryTexts[queryIndex]).toHaveTextContent(expectedQueryText);
    });
  });
};

export const assertQueryHistoryIsStarred = async (expectedStars: boolean[], exploreId: ExploreId = ExploreId.left) => {
  const selector = withinExplore(exploreId);
  const starButtons = selector.getAllByRole('button', { name: /Star query|Unstar query/ });
  await waitFor(() =>
    expectedStars.forEach((starred, queryIndex) => {
      expect(starButtons[queryIndex]).toHaveAccessibleName(starred ? 'Unstar query' : 'Star query');
    })
  );
};

export const assertQueryHistoryTabIsSelected = (
  tabName: 'Query history' | 'Starred' | 'Settings',
  exploreId: ExploreId = ExploreId.left
) => {
  expect(withinExplore(exploreId).getByRole('tab', { name: `Tab ${tabName}`, selected: true })).toBeInTheDocument();
};

export const assertDataSourceFilterVisibility = (visible: boolean, exploreId: ExploreId = ExploreId.left) => {
  const filterInput = withinExplore(exploreId).queryByLabelText('Filter queries for data sources(s)');
  if (visible) {
    expect(filterInput).toBeInTheDocument();
  } else {
    expect(filterInput).not.toBeInTheDocument();
  }
};

export const assertQueryHistoryElementsShown = (
  shown: number,
  total: number,
  exploreId: ExploreId = ExploreId.left
) => {
  expect(withinExplore(exploreId).queryByText(`Showing ${shown} of ${total}`)).toBeInTheDocument();
};

export const assertLoadMoreQueryHistoryNotVisible = (exploreId: ExploreId = ExploreId.left) => {
  expect(withinExplore(exploreId).queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
};
