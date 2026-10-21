import { render, screen } from 'test/test-utils';

import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

function baseHit(overrides: Partial<RecordingRuleSearchHit> = {}): RecordingRuleSearchHit {
  return { uid: 'rule-1', title: 'cpu:usage:rate5m', folderUid: 'folder-1', ...overrides };
}

function renderRow(props: Parameters<typeof RecordingRuleRow>[0]) {
  return render(
    <ul>
      <RecordingRuleRow {...props} />
    </ul>
  );
}

describe('RecordingRuleRow', () => {
  it('links the title to the rule view and labels the list item with it', () => {
    renderRow({ hit: baseHit() });

    expect(screen.getByRole('link', { name: 'cpu:usage:rate5m' })).toHaveAttribute(
      'href',
      '/alerting/grafana/rule-1/view'
    );
    expect(screen.getByRole('listitem', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
  });

  it('shows the Recording status icon when health is Recording', () => {
    renderRow({ hit: baseHit({ health: 'Recording' }) });

    expect(screen.getByLabelText('Recording')).toBeInTheDocument();
  });

  it('reads Status unavailable, never Recording, when the hit carries no health', () => {
    renderRow({ hit: baseHit() });

    expect(screen.getByLabelText('Status unavailable')).toBeInTheDocument();
  });

  it.each([
    { name: 'is known', folderPath: ['Platform', 'Team Metrics'], shown: true },
    { name: 'is still loading', folderPath: undefined, shown: false },
  ])('shows the folder path only when it $name', ({ folderPath, shown }) => {
    renderRow({ hit: baseHit(), folderPath });

    expect(screen.getByRole('link', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
    expect(screen.queryByText('Team Metrics') !== null).toBe(shown);
  });
});
