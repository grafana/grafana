import { render, screen } from 'test/test-utils';

import { setPluginExtensionsHook } from '@grafana/runtime';
import { RuleListStateView } from 'app/features/alerting/unified/components/rules/RuleListStateView';
import {
  mockCombinedRule,
  mockCombinedRuleGroup,
  mockCombinedRuleNamespace,
  mockPromAlertingRule,
} from 'app/features/alerting/unified/mocks';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

setPluginExtensionsHook(() => ({
  extensions: [],
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
  it('renders differing prom rule states correctly and does not crash with missing state', () => {
    render(<RuleListStateView namespaces={namespaces} />);

    expect(screen.getByText(/firing \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/pending \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/normal \(1\)/i)).toBeInTheDocument();
  });
});
