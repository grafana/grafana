import { render, screen, userEvent } from 'test/test-utils';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { makeDeletedRule } from '../mocks/handlers';

import { DeletedRulesTable } from './DeletedRulesTable';

function renderTable(rules: AlertRule[], overrides = {}) {
  return render(
    <DeletedRulesTable
      rules={rules}
      folderPaths={{ 'folder-uid': 'Platform / Infra' }}
      userNames={{ 'user-uid-123': 'Alice Smith' }}
      onReview={jest.fn()}
      onRestore={jest.fn()}
      hasMore={false}
      isLoadingMore={false}
      onLoadMore={jest.fn()}
      {...overrides}
    />
  );
}

describe('DeletedRulesTable', () => {
  it('renders rule title', async () => {
    renderTable([makeDeletedRule()]);
    expect(await screen.findByText('Deleted rule')).toBeInTheDocument();
  });

  it('shows resolved folder path', () => {
    renderTable([makeDeletedRule()]);
    expect(screen.getByText('Platform / Infra')).toBeInTheDocument();
  });

  it('shows resolved user display name', () => {
    renderTable([makeDeletedRule()]);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('falls back to UID when user name is unavailable', () => {
    renderTable([makeDeletedRule()], { userNames: {} });
    expect(screen.getByText('user-uid-123')).toBeInTheDocument();
  });

  it('shows "Unknown" when updatedBy annotation is absent', () => {
    const rule = makeDeletedRule();
    delete rule.metadata.annotations?.['grafana.app/updatedBy'];
    renderTable([rule]);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('calls onReview when Review button is clicked', async () => {
    const onReview = jest.fn();
    renderTable([makeDeletedRule()], { onReview });
    await userEvent.click(screen.getByRole('button', { name: /Review/i }));
    expect(onReview).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.any(Object) }));
  });

  it('calls onRestore when Restore button is clicked', async () => {
    const onRestore = jest.fn();
    renderTable([makeDeletedRule()], { onRestore });
    await userEvent.click(screen.getByRole('button', { name: /Restore/i }));
    expect(onRestore).toHaveBeenCalled();
  });

  it('shows Load more button when hasMore is true', () => {
    renderTable([makeDeletedRule()], { hasMore: true });
    expect(screen.getByRole('button', { name: /Load more/i })).toBeInTheDocument();
  });

  it('shows empty state when no rules', () => {
    renderTable([]);
    expect(screen.getByText(/No recently deleted/i)).toBeInTheDocument();
  });
});
