import { type ComponentProps } from 'react';
import { render, screen } from 'test/test-utils';

import { type GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';
import { type GrafanaPromAlertingRuleDTO, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { mockGrafanaPromAlertingRule } from '../mocks';

import { GrafanaRuleListItem } from './GrafanaRuleListItem';
import { RuleActionsButtons } from './components/RuleActionsButtons.V2';

jest.mock('./components/RuleActionsButtons.V2', () => ({ RuleActionsButtons: jest.fn(() => null) }));
const mockRuleActionsButtons = jest.mocked(RuleActionsButtons);

const groupIdentifier: GrafanaRuleGroupIdentifier = {
  groupName: 'my-group',
  namespace: { uid: 'my-folder-uid' },
  groupOrigin: 'grafana',
};
const rule = mockGrafanaPromAlertingRule({
  uid: 'rule-uid',
  name: 'High CPU usage',
  lastEvaluation: '2026-11-24T10:00:00Z',
  evaluationTime: 0.01,
});
const NEXT_EVALUATION = { lastEvaluation: '2026-11-24T10:01:00Z', evaluationTime: 0.02 };

const row = (props: Partial<ComponentProps<typeof GrafanaRuleListItem>> = {}) => (
  <GrafanaRuleListItem rule={rule} groupIdentifier={groupIdentifier} namespaceName="my-folder" {...props} />
);

describe('GrafanaRuleListItem', () => {
  beforeEach(() => {
    mockRuleActionsButtons.mockClear();
  });

  it('does not re-render when only the evaluation timestamps of the rule change', () => {
    const { rerender } = render(row());
    expect(mockRuleActionsButtons).toHaveBeenCalledTimes(1);

    rerender(row({ rule: { ...rule, ...NEXT_EVALUATION } }));

    expect(mockRuleActionsButtons).toHaveBeenCalledTimes(1);
  });

  // A poll always brings new timestamps, so every case changes them too: a change in what the row shows must win
  it.each<{ field: string; patch: Partial<GrafanaPromAlertingRuleDTO>; find: () => HTMLElement | null }>([
    {
      field: 'summary',
      patch: { annotations: { summary: 'Disk almost full' } },
      find: () => screen.queryByText('Disk almost full'),
    },
    { field: 'last error', patch: { lastError: 'query failed' }, find: () => screen.queryByText('query failed') },
    {
      field: 'label count',
      patch: { labels: { severity: 'warning', team: 'ops' } },
      find: () => screen.queryByText('2 labels'),
    },
    { field: 'instance count', patch: { totals: { alerting: 3 } }, find: () => screen.queryByText('3 instances') },
    {
      field: 'state',
      patch: { state: PromAlertingRuleState.Inactive },
      find: () => screen.queryByLabelText('Normal'),
    },
    { field: 'health', patch: { health: 'error' }, find: () => screen.queryByLabelText('Failed to evaluate rule') },
    { field: 'paused flag', patch: { isPaused: true }, find: () => screen.queryByLabelText('Paused') },
  ])('shows the new $field when it changes along with the evaluation timestamps', ({ patch, find }) => {
    const { rerender } = render(row());
    expect(find()).not.toBeInTheDocument();

    rerender(row({ rule: { ...rule, ...patch, ...NEXT_EVALUATION } }));

    expect(find()).toBeInTheDocument();
  });

  it('shows the new folder name when only the namespaceName prop changes', () => {
    const { rerender } = render(row());
    expect(screen.getByText(/my-folder/)).toBeInTheDocument();

    rerender(row({ namespaceName: 'renamed-folder' }));

    expect(screen.getByText(/renamed-folder/)).toBeInTheDocument();
  });
});
