import { screen } from '@testing-library/react';

import { QueryOptionsOverlay } from './QueryOptionsOverlay';
import { mockQueryOptionsState, renderWithQueryEditorProvider } from './testUtils';

function renderOverlay(isQueryOptionsOpen: boolean) {
  return renderWithQueryEditorProvider(
    <QueryOptionsOverlay>
      <button>Edit query</button>
    </QueryOptionsOverlay>,
    { uiStateOverrides: { queryOptions: { ...mockQueryOptionsState, isQueryOptionsOpen } } }
  );
}

describe('QueryOptionsOverlay', () => {
  it('makes the content behind the open sidebar inert while keeping the sidebar interactive', () => {
    renderOverlay(true);

    expect(screen.getByLabelText('Max data points').closest('[inert]')).toBeNull();
    expect(screen.getByText('Edit query').closest('[inert]')).toBeInTheDocument();
  });

  it('keeps the content interactive when the sidebar is closed', () => {
    renderOverlay(false);

    expect(screen.getByRole('button', { name: 'Edit query' }).closest('[inert]')).toBeNull();
  });
});
