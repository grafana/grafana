import { screen } from '@testing-library/react';

import { QueriesEmptyState } from './QueriesEmptyState';
import { renderWithQueryEditorProvider } from './testUtils';

describe('QueriesEmptyState', () => {
  it('renders the call-to-action message', () => {
    renderWithQueryEditorProvider(<QueriesEmptyState />);

    expect(screen.getByText('Add a query, expression, or transformation to get started')).toBeInTheDocument();
  });

  it('adds and selects a new query when the button is clicked', async () => {
    const addQuery = jest.fn().mockReturnValue('B');
    const setSelectedQuery = jest.fn();

    const { user } = renderWithQueryEditorProvider(<QueriesEmptyState />, {
      actionsOverrides: { addQuery },
      uiStateOverrides: { setSelectedQuery },
    });

    await user.click(screen.getByRole('button', { name: 'Add query' }));

    expect(addQuery).toHaveBeenCalledTimes(1);
    expect(setSelectedQuery).toHaveBeenCalledWith({ refId: 'B', hide: false });
  });
});
