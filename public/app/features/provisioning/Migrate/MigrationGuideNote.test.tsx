import { render, screen } from 'test/test-utils';

import { MigrationGuideNote } from './MigrationGuideNote';

describe('MigrationGuideNote', () => {
  it('renders the note linking to the provisioning documentation', () => {
    render(<MigrationGuideNote />);

    expect(screen.getByText(/the guided migration workflow is on its way/i)).toBeInTheDocument();
    const docsLink = screen.getByRole('link', { name: /provisioning documentation/i });
    expect(docsLink).toHaveAttribute('href', expect.stringContaining('grafana.com/docs'));
  });
});
