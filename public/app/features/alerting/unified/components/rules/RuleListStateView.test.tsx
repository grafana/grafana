import { render, screen, within } from 'test/test-utils';

import { setPluginLinksHook } from '@grafana/runtime';
import { RuleListStateView } from 'app/features/alerting/unified/components/rules/RuleListStateView';
import {
  mockCombinedRule,
  mockCombinedRuleGroup,
  mockCombinedRuleNamespace,
  mockGrafanaRulerRule,
  mockPromAlertingRule,
} from 'app/features/alerting/unified/mocks';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

jest.mock('@grafana/assistant', () => ({
  useAssistant: () => ({ isAvailable: false, openAssistant: jest.fn() }),
}));

setPluginLinksHook(() => ({
  links: [],
  isLoading: false,
}));

const namespaces = [
  mockCombinedRuleNamespace({
    groups: [
      mockCombinedRuleGroup('Group with a missing state', [
        mockCombinedRule({
          name: 'Rule in firing state',
          promRule: mockPromAlertingRule({
            state: PromAlertingRuleState.Firing,
          }),
        }),
        mockCombinedRule({
          name: 'Rule in pending state',
          promRule: mockPromAlertingRule({
            state: PromAlertingRuleState.Pending,
          }),
        }),
        mockCombinedRule({
          name: 'Rule in inactive state',
          promRule: mockPromAlertingRule({
            state: PromAlertingRuleState.Inactive,
          }),
        }),
        mockCombinedRule({
          name: 'Rule with missing prom state',
          promRule: mockPromAlertingRule({
            state: undefined,
          }),
        }),
      ]),
    ],
  }),
];

describe('RuleListStateView', () => {
  it.each([
    { provenance: 'converted_prometheus', badge: 'Imported' },
    { provenance: 'file', badge: 'Provisioned' },
  ])('renders $badge for a rule with $provenance provenance', async ({ provenance, badge }) => {
    const rule = mockCombinedRule({
      rulerRule: mockGrafanaRulerRule({ provenance }),
      promRule: mockPromAlertingRule({ state: PromAlertingRuleState.Firing }),
    });
    const namespaces = [mockCombinedRuleNamespace({ groups: [mockCombinedRuleGroup('Provisioned rules', [rule])] })];

    const { user } = render(<RuleListStateView namespaces={namespaces} />);
    await user.click(within(screen.getByRole('treeitem', { name: 'Firing 1' })).getByRole('button'));

    expect(screen.getByText(badge)).toBeInTheDocument();
  });

  it('renders differing prom rule states correctly and does not crash with missing state', () => {
    render(<RuleListStateView namespaces={namespaces} />);

    expect(screen.getByRole('treeitem', { name: 'Firing 1' })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'Pending 1' })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'Normal 1' })).toBeInTheDocument();
  });
});
