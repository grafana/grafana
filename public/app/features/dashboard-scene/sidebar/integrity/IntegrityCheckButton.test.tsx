import { act, screen, waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';

import { Sidebar, useSidebar } from '@grafana/ui';

import { DashboardEditIntegrityTracker } from '../DashboardEditIntegrityTracker';

import { IntegrityCheckButton, IntegrityCheckModal } from './IntegrityCheckButton';

function TestSidebar({ tracker }: { tracker: DashboardEditIntegrityTracker }) {
  const contextValue = useSidebar({});
  return (
    <Sidebar contextValue={contextValue}>
      <IntegrityCheckButton tracker={tracker} />
    </Sidebar>
  );
}

it('checks on open, preserves findings on reopen, and clears the warning only on request', async () => {
  const model = { schemaVersion: 42, title: 'initial' };
  const tracker = new DashboardEditIntegrityTracker(() => model);
  const { user } = render(<TestSidebar tracker={tracker} />);
  model.title = 'untracked';
  await user.click(screen.getByRole('button', { name: 'Check undo/redo integrity' }));
  expect(await screen.findByText(/Untracked changes/)).toBeInTheDocument();
  await user.click(screen.getByText(/Untracked changes/));
  expect(screen.getByText('replace /title')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Undo/redo diagnostics: findings need review' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Close' }));
  await user.click(screen.getByRole('button', { name: 'Undo/redo diagnostics: findings need review' }));
  await screen.findByRole('button', { name: 'Clear history' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Clear history' })).toBeEnabled());
  expect(tracker.state.records).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Clear history' }));
  expect(screen.getByRole('button', { name: 'Check undo/redo integrity' })).toBeInTheDocument();
});

it('checks again and clears findings and the warning on request', async () => {
  const model = { schemaVersion: 42, title: 'initial' };
  const tracker = new DashboardEditIntegrityTracker(() => model);
  const { user } = render(<TestSidebar tracker={tracker} />);
  await user.click(screen.getByRole('button', { name: 'Check undo/redo integrity' }));
  expect(await screen.findByText('No untracked changes detected.')).toBeInTheDocument();
  model.title = 'untracked';
  await user.click(screen.getByRole('button', { name: 'Check again' }));
  expect(await screen.findByText(/Untracked changes/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Clear history' }));
  expect(screen.getByText('No untracked changes detected.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Check undo/redo integrity' })).toBeInTheDocument();
});

it('distinguishes committed changes from integrity errors', async () => {
  const model = { schemaVersion: 42, title: 'initial' };
  const tracker = new DashboardEditIntegrityTracker(() => model);
  const { user } = render(<TestSidebar tracker={tracker} />);
  model.title = 'committed';
  act(() => tracker.check('Resize', 'committed'));
  await user.click(screen.getByRole('button', { name: 'Undo/redo diagnostics: findings need review' }));
  expect(await screen.findByText(/Unable to verify committed change/)).toBeInTheDocument();
});

it('shows progress before reporting the manual check result', async () => {
  const tracker = new DashboardEditIntegrityTracker(() => ({ title: 'initial', schemaVersion: 42 }));
  render(<IntegrityCheckModal tracker={tracker} onDismiss={() => {}} />);
  expect(screen.getByRole('status')).toHaveTextContent('Checking…');
  expect(await screen.findByText('No untracked changes detected.')).toBeVisible();
});

it('shows potentially delayed actions with a manual verification explanation', async () => {
  const model = { schemaVersion: 42, title: 'initial' };
  const tracker = new DashboardEditIntegrityTracker(() => model);
  model.title = 'typed';
  tracker.run('Title blur', () => {
    model.title = 'typed';
  });
  const { user } = render(<TestSidebar tracker={tracker} />);
  await user.click(screen.getByRole('button', { name: 'Undo/redo diagnostics: findings need review' }));
  await user.click(await screen.findByText('Potentially delayed action'));
  expect(screen.getByText('Manual verification needed')).toBeVisible();
  expect(screen.getByText('replace /title')).toBeVisible();
  expect(screen.getByText(/An unrelated no-op can look the same/)).toBeVisible();
});
