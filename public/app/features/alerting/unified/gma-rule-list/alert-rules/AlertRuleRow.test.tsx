import { render, screen } from 'test/test-utils';

import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './alertRuleSearchHit';

function baseHit(overrides: Partial<AlertRuleSearchHit> = {}): AlertRuleSearchHit {
  return { uid: 'rule-1', title: 'CPU high', folderUid: 'folder-1', ...overrides };
}

function renderRow(props: Parameters<typeof AlertRuleRow>[0]) {
  return render(
    <ul>
      <AlertRuleRow {...props} />
    </ul>
  );
}

describe('AlertRuleRow', () => {
  it('links the title to the rule view and labels the list item with it', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.getByRole('link', { name: 'CPU high' })).toHaveAttribute('href', '/alerting/grafana/rule-1/view');
    expect(screen.getByRole('listitem', { name: 'CPU high' })).toBeInTheDocument();
  });

  it('shows the status icon of the search hit', () => {
    renderRow({ searchHit: baseHit({ state: 'Firing', health: 'OK' }) });

    expect(screen.getByLabelText('Firing')).toBeInTheDocument();
  });

  it('reads Status unavailable, never healthy, when the hit carries no status', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.getByLabelText('Status unavailable')).toBeInTheDocument();
  });

  it.each([
    { name: 'is known', folderPath: ['Platform', 'Team Alerts'], shown: true },
    { name: 'is still loading', folderPath: undefined, shown: false },
  ])('shows the folder path only when it $name', ({ folderPath, shown }) => {
    renderRow({ searchHit: baseHit(), folderPath });

    expect(screen.getByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByText('Team Alerts') !== null).toBe(shown);
  });

  it('shows the last error when the hit has one', () => {
    renderRow({ searchHit: baseHit({ lastError: 'remote write failed' }) });

    expect(screen.getByText('remote write failed')).toBeInTheDocument();
  });

  it('shows the summary annotation when there is no error', () => {
    renderRow({ searchHit: baseHit({ summary: 'CPU usage is high' }) });

    expect(screen.getByText('CPU usage is high')).toBeInTheDocument();
  });

  it('shows no description when neither error nor summary is present', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByText('remote write failed')).not.toBeInTheDocument();
    expect(screen.queryByText('CPU usage is high')).not.toBeInTheDocument();
  });

  it('shows the evaluation interval', () => {
    renderRow({ searchHit: baseHit({ interval: '5m' }) });

    expect(screen.getByRole('img', { name: 'Evaluated every 5m' })).toBeInTheDocument();
  });

  it('shows no interval indicator when interval is absent', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByRole('img', { name: /Evaluated every/ })).not.toBeInTheDocument();
  });
});
