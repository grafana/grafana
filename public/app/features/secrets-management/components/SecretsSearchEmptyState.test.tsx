import { render, screen } from 'test/test-utils';

import { SecretsSearchEmptyState } from './SecretsSearchEmptyState';

describe('SecretsSearchEmptyState', () => {
  it('should inform user that no secrets were found', () => {
    render(<SecretsSearchEmptyState />);
    expect(screen.getByText(/no secrets found/i)).toBeInTheDocument();
  });

  it('should inform user that filters can be cleared ', () => {
    render(<SecretsSearchEmptyState />);
    expect(screen.getByText(/clear active filter to see all secrets/i)).toBeInTheDocument();
  });
});
