import { render, screen, within } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';

import RecordingRulesPage from './RecordingRulesPage';
import { findFolderRow, setup } from './recordingRulesPageFixture';

setupMswServer();

describe('RecordingRulesPage rules in an expanded folder', () => {
  it("shows a folder's own rules inside its row when expanded, and hides them when collapsed", async () => {
    setup();
    const { user } = render(<RecordingRulesPage />);
    const row = await findFolderRow('Team Metrics');

    await user.click(within(row).getByRole('button', { name: 'Expand Team Metrics' }));

    const ruleLink = await within(row).findByRole('link', { name: 'cpu:usage:rate5m' });
    expect(within(row).getByRole('link', { name: 'disk:usage:rate5m' })).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'mem:usage:rate5m' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'latency:p99' })).not.toBeInTheDocument();
    // The folder row already names the folder, so the rule row has no path of its own.
    expect(ruleLink.closest('li')).not.toHaveTextContent('Team Metrics');

    await user.click(screen.getByRole('button', { name: 'Collapse Team Metrics' }));

    expect(screen.queryByRole('link', { name: 'cpu:usage:rate5m' })).not.toBeInTheDocument();
  });

  it('keeps a separate Load more for each expanded folder', async () => {
    setup({ pageSize: { rules: 2 } });
    const { user } = render(<RecordingRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand Team Metrics' }));
    await user.click(screen.getByRole('button', { name: 'Expand Infra' }));
    expect(await screen.findByRole('link', { name: 'latency:p99' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'disk:usage:rate5m' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'mem:usage:rate5m' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more rules in Infra' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more rules in Team Metrics' }));

    expect(await screen.findByRole('link', { name: 'mem:usage:rate5m' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'latency:p99' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Load more/ })).not.toBeInTheDocument();
  });

  it('shows a message for an expanded folder that has no Recording rules', async () => {
    setup();
    const { user } = render(<RecordingRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand Zeta Alerts' }));

    expect(await screen.findByText('No recording rules in this folder')).toBeInTheDocument();
  });

  it('shows an expanded folder rule search failure with Retry, and the rules after Retry', async () => {
    setup().failNext('ruleSearch');
    const { user } = render(<RecordingRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand Team Metrics' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load rules');

    await user.click(screen.getByRole('button', { name: 'Retry loading rules in Team Metrics' }));

    expect(await screen.findByRole('link', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
    expect(screen.queryByText('Failed to load rules')).not.toBeInTheDocument();
  });
});
