import { waitFor } from '@testing-library/react';
import { ExploreId } from '../../../../types';
import { withinExplore } from './setup';

export const assertQueryHistoryExists = (query: string, exploreId: ExploreId = ExploreId.left) => {
  const selector = withinExplore(exploreId);

  expect(selector.getByText('1 queries')).toBeInTheDocument();
  const queryItem = selector.getByLabelText('Query text');
  expect(queryItem).toHaveTextContent(query);
};

export const assertQueryHistory = async (queries: string[], exploreId: ExploreId = ExploreId.left) => {
  const selector = withinExplore(exploreId);
  await waitFor(() => {
    expect(selector.getByText(`${queries.length} queries`)).toBeInTheDocument();
  });
};

export const assertQueryHistoryIsStarred = async (
  queryIndex: number,
  starred: boolean,
  exploreId: ExploreId = ExploreId.left
) => {
  const selector = withinExplore(exploreId);
  const starButtons = selector.getAllByRole('button', { name: /Star query|Unstar query/ });
  await waitFor(() =>
    expect(starButtons[queryIndex].getAttribute('title')).toBe(starred ? 'Unstar query' : 'Star query')
  );
};
