import { render, screen } from 'test/test-utils';

import { GitSyncLimitationsAlert } from './GitSyncLimitationsAlert';

describe('GitSyncLimitationsAlert', () => {
  it('shows the limitations, docs link and announcement banner advice', async () => {
    render(<GitSyncLimitationsAlert />);

    expect(await screen.findByText(/review git sync limitations before proceeding/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /git sync documentation/i })).toHaveAttribute(
      'href',
      expect.stringContaining('grafana.com/docs')
    );
    expect(screen.getByText(/announcement banner/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /this guide/i })).toHaveAttribute(
      'href',
      expect.stringContaining('announcement-banner')
    );
  });

  it('warns that alerts and library panels are lost for an instance migration', async () => {
    render(<GitSyncLimitationsAlert syncTarget="instance" />);

    expect(await screen.findByText(/existing alerts and library panels will be lost/i)).toBeInTheDocument();
    expect(screen.queryByText(/folder structure will be replicated/i)).not.toBeInTheDocument();
  });

  it('explains the folder caveats for a folder migration', async () => {
    render(<GitSyncLimitationsAlert syncTarget="folder" />);

    expect(await screen.findByText(/folder structure will be replicated/i)).toBeInTheDocument();
    expect(screen.getByText(/manually remove or manage original folders/i)).toBeInTheDocument();
    expect(screen.queryByText(/existing alerts and library panels will be lost/i)).not.toBeInTheDocument();
  });
});
