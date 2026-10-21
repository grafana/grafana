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
    renderRow({ hit: baseHit() });

    expect(screen.getByRole('link', { name: 'CPU high' })).toHaveAttribute('href', '/alerting/grafana/rule-1/view');
    expect(screen.getByRole('listitem', { name: 'CPU high' })).toBeInTheDocument();
  });

  it('shows the status icon of the search hit', () => {
    renderRow({ hit: baseHit({ state: 'Firing', health: 'OK' }) });

    expect(screen.getByLabelText('Firing')).toBeInTheDocument();
  });

  it('reads Status unavailable, never healthy, when the hit carries no status', () => {
    renderRow({ hit: baseHit() });

    expect(screen.getByLabelText('Status unavailable')).toBeInTheDocument();
  });

  it.each([
    { name: 'is known', folderPath: ['Platform', 'Team Alerts'], shown: true },
    { name: 'is still loading', folderPath: undefined, shown: false },
  ])('shows the folder path only when it $name', ({ folderPath, shown }) => {
    renderRow({ hit: baseHit(), folderPath });

    expect(screen.getByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByText('Team Alerts') !== null).toBe(shown);
  });
});
