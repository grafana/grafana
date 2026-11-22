import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { jsonDiff } from 'app/features/dashboard-scene/settings/version-history/utils';

import {
  getCommitDetailsMessages,
  getCommitTitle,
  getDiffSummary,
  getPanelTitles,
  parseCommitDetails,
} from './commitDetails';

const v1Dashboard: Dashboard = {
  title: 'Infra',
  schemaVersion: 41,
  panels: [
    { id: 1, type: 'timeseries', title: 'CPU' },
    { id: 2, type: 'row', title: 'Network', collapsed: true, panels: [{ id: 3, type: 'stat', title: 'Packets' }] },
    { id: 4, type: 'text', title: '' },
  ],
};

describe('getPanelTitles', () => {
  it('lists v1 panel titles, including panels nested in collapsed rows, and skips untitled panels', () => {
    expect(getPanelTitles(v1Dashboard)).toEqual(['CPU', 'Network', 'Packets']);
  });

  it('lists v2 element titles', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const v2 = {
      title: 'Infra',
      elements: {
        'panel-1': { kind: 'Panel', spec: { title: 'Memory' } },
        'panel-2': { kind: 'Panel', spec: { title: 'Disk' } },
      },
      layout: { kind: 'GridLayout', spec: { items: [] } },
    } as unknown as DashboardV2Spec;
    expect(getPanelTitles(v2)).toEqual(['Memory', 'Disk']);
  });
});

describe('getDiffSummary', () => {
  it('renders one line per change with old and new values', () => {
    const before = { title: 'Infra', panels: [{ title: 'CPU' }], tags: ['a'] };
    const after = { title: 'Infra', panels: [{ title: 'CPU usage' }], refresh: '5m' };
    expect(getDiffSummary(jsonDiff(before, after))).toEqual([
      'changed panels.0.title: "CPU" -> "CPU usage"',
      'deleted tags (was ["a"])',
      'added refresh: "5m"',
    ]);
  });

  it('caps the summary and reports how many changes were left out', () => {
    const before = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`k${i}`, 0]));
    const after = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`k${i}`, 1]));
    const lines = getDiffSummary(jsonDiff(before, after));
    expect(lines).toHaveLength(61);
    expect(lines[60]).toBe('…and 5 more changes');
  });
});

describe('getCommitDetailsMessages', () => {
  it('asks only for the keys that apply and includes the dashboard details and diff', () => {
    const [system, user] = getCommitDetailsMessages({
      action: 'update',
      title: 'Infra',
      description: 'Hosts overview',
      path: 'dashboards/infra.json',
      saveModel: v1Dashboard,
      diffs: jsonDiff({ refresh: '' }, { refresh: '1m' }),
      includeBranch: true,
      includePullRequestDescription: false,
    });

    expect(system.content).toContain('"commitMessage"');
    expect(system.content).toContain('"branch"');
    expect(system.content).not.toContain('"pullRequestDescription"');
    expect(user.content).toBe(
      [
        'Action: update an existing dashboard',
        'Dashboard title: Infra',
        'Dashboard description: Hosts overview',
        'File path in the repository: dashboards/infra.json',
        'Panels (3):\n- CPU\n- Network\n- Packets',
        'Changes to the dashboard JSON:\nchanged refresh: "" -> "1m"',
      ].join('\n\n')
    );
  });

  it('omits the changes section for a new dashboard', () => {
    const [, user] = getCommitDetailsMessages({
      action: 'create',
      title: 'New',
      path: 'new.json',
      saveModel: { title: 'New', schemaVersion: 41, panels: [] },
      includeBranch: false,
      includePullRequestDescription: true,
    });
    expect(user.content).toBe(
      [
        'Action: create a new dashboard',
        'Dashboard title: New',
        'File path in the repository: new.json',
        'Panels: none',
      ].join('\n\n')
    );
  });
});

describe('parseCommitDetails', () => {
  it('parses a JSON reply wrapped in a code fence and sanitizes the branch name', () => {
    const reply =
      '```json\n{"commitMessage": " Add CPU panel\\n\\n- Adds a CPU panel ", "branch": "Dashboard/Add CPU Panel!", "pullRequestDescription": "Adds a panel."}\n```';
    expect(parseCommitDetails(reply)).toEqual({
      commitMessage: 'Add CPU panel\n\n- Adds a CPU panel',
      branch: 'dashboard/add-cpu-panel',
      pullRequestDescription: 'Adds a panel.',
    });
  });

  it('caps the pull request description at 2000 characters', () => {
    const reply = JSON.stringify({ commitMessage: 'x', pullRequestDescription: 'a'.repeat(2500) });
    expect(parseCommitDetails(reply)?.pullRequestDescription).toHaveLength(2000);
  });

  it.each([
    { desc: 'plain text', reply: 'Add CPU panel' },
    { desc: 'invalid JSON', reply: '{"commitMessage": }' },
    { desc: 'no usable string values', reply: '{"commitMessage": 3, "branch": "!!!"}' },
  ])('returns undefined for $desc', ({ reply }) => {
    expect(parseCommitDetails(reply)).toBeUndefined();
  });
});

describe('getCommitTitle', () => {
  it('returns the first line of a multi-line message', () => {
    expect(getCommitTitle('\n Add CPU panel \n\n- details')).toBe('Add CPU panel');
  });
});
