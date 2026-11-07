import { screen } from '@testing-library/react';

import { mockQueryOptionsState, renderWithQueryEditorProvider } from '../testUtils';

import { QueryEditorBody } from './QueryEditorBody';

describe('QueryEditorBody', () => {
  it('renders its children alongside the query options sidebar when query options are open', () => {
    renderWithQueryEditorProvider(
      <QueryEditorBody>
        <div data-testid="body-content" />
      </QueryEditorBody>,
      { uiStateOverrides: { queryOptions: { ...mockQueryOptionsState, isQueryOptionsOpen: true } } }
    );

    expect(screen.getByTestId('body-content')).toBeInTheDocument();
    expect(screen.getByLabelText('Max data points')).toBeInTheDocument();
  });
});
