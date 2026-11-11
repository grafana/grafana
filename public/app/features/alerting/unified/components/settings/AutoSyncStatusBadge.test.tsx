import { render, screen } from 'test/test-utils';

import { type AutoSyncHealth, type AutoSyncState } from '../../utils/autoSync';

import { AutoSyncStatusBadge, SyncedCopyStatusBadge } from './AutoSyncStatusBadge';

const configured: AutoSyncState = { kind: 'configured', uid: 'mimir-uid' };

function renderBadge(state: AutoSyncState, syncHealth: AutoSyncHealth = { kind: 'healthy' }) {
  return render(<AutoSyncStatusBadge state={state} syncHealth={syncHealth} />);
}

describe('AutoSyncStatusBadge', () => {
  it('shows Active when the sync condition is healthy', () => {
    renderBadge(configured, { kind: 'healthy' });
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows Sync failing when the sync condition is False', () => {
    renderBadge(configured, { kind: 'failing', reason: 'MimirFetchFailed', message: 'connection refused' });
    expect(screen.getByText('Sync failing')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('shows Sync stopped — not Active — once the merge is committed', () => {
    renderBadge(configured, { kind: 'merge-committed' });
    expect(screen.getByText('Sync stopped')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('shows Pending first sync when no verdict has been recorded yet', () => {
    renderBadge(configured, { kind: 'pending' });
    expect(screen.getByText('Pending first sync')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('reports failing for an orphaned UID too', () => {
    renderBadge({ kind: 'orphan-uid', uid: 'missing-uid' }, { kind: 'failing', reason: 'DatasourceLookupFailed' });
    expect(screen.getByText('Sync failing')).toBeInTheDocument();
  });

  it('keeps showing Managed by operator regardless of health', () => {
    renderBadge({ kind: 'operator-managed', uid: 'ini-uid' }, { kind: 'failing', reason: 'SaveFailed' });
    expect(screen.getByText('Managed by operator')).toBeInTheDocument();
    expect(screen.queryByText('Sync failing')).not.toBeInTheDocument();
  });

  it('shows Not configured when no UID is set', () => {
    renderBadge({ kind: 'unconfigured' }, { kind: 'pending' });
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });

  it('renders nothing when there are no datasources', () => {
    const { container } = renderBadge({ kind: 'no-datasources' });
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SyncedCopyStatusBadge', () => {
  it('says synced only while the sync is healthy and its copy exists', () => {
    render(<SyncedCopyStatusBadge uid="ds-1" syncHealth={{ kind: 'healthy' }} hasSyncedCopy />);
    expect(screen.getByText(/synced · read-only/i)).toBeInTheDocument();
  });

  it.each([
    ['failing', { kind: 'failing', reason: 'MimirFetchFailed' } as const, /sync failing/i],
    ['pending', { kind: 'pending' } as const, /pending first sync/i],
    ['stopped', { kind: 'merge-committed' } as const, /sync stopped/i],
  ])('shows a %s sync as such even with a copy from an earlier sync', (_, syncHealth, expected) => {
    render(<SyncedCopyStatusBadge uid="ds-1" syncHealth={syncHealth} hasSyncedCopy />);
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(/synced · read-only/i)).not.toBeInTheDocument();
  });

  it('shows a healthy sync without a copy as active', () => {
    render(<SyncedCopyStatusBadge uid="ds-1" syncHealth={{ kind: 'healthy' }} hasSyncedCopy={false} />);
    expect(screen.getByText(/^active$/i)).toBeInTheDocument();
  });
});
