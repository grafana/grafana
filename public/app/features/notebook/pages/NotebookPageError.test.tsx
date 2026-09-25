import { render, screen } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';

import { NotebookPageError } from './NotebookPageError';

describe('NotebookPageError', () => {
  it('renders the not-found state for a 404', () => {
    render(<NotebookPageError error={{ status: 404, message: 'notebooks.dashboard.grafana.app "nb-1" not found' }} />);

    expect(screen.getByTestId(selectors.components.EntityNotFound.container)).toBeInTheDocument();
    expect(screen.getByText('Notebook not found')).toBeInTheDocument();
    expect(screen.queryByTestId('notebook-page-error')).not.toBeInTheDocument();
  });

  it('renders the generic failure state for any other status', () => {
    render(<NotebookPageError error={{ status: 500, message: 'internal server error' }} />);

    const alert = screen.getByTestId('notebook-page-error');
    expect(alert).toHaveTextContent('internal server error');
    expect(screen.queryByTestId(selectors.components.EntityNotFound.container)).not.toBeInTheDocument();
  });

  it('renders the generic failure state when there is no status', () => {
    render(<NotebookPageError error={{ message: 'Notebook not found' }} />);

    expect(screen.getByTestId('notebook-page-error')).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.EntityNotFound.container)).not.toBeInTheDocument();
  });
});
