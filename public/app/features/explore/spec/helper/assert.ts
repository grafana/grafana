import { waitFor } from '@testing-library/react';
import { ExploreId } from '../../../../types';
import { withinExplore } from './setup';

export const assertQueryHistoryExists = (query: string, exploreId: ExploreId = ExploreId.left) => {
  const selector = withinExplore(exploreId);

  expect(selector.getByText('1 queries')).toBeInTheDocument();
  const queryItem = selector.getByLabelText('Query text');
  expect(queryItem).toHaveTextContent(query);
};

export const assertQueryHistory = async (expectedQueryTexts: string[], exploreId: ExploreId = ExploreId.left) => {
  const selector = withinExplore(exploreId);
  await waitFor(() => {
    expect(selector.getByText(`${expectedQueryTexts.length} queries`)).toBeInTheDocument();
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
