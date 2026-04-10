import { getWrapper, render, renderHook, screen, waitFor } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';
import { type CombinedRule } from 'app/types/unified-alerting';

import { setupMswServer } from '../../mockApi';
import { getCloudRule, getGrafanaRule, mockDataSource } from '../../mocks';
import { setFolderAccessControl } from '../../mocks/server/configure';
import { setupDataSources } from '../../testSetup/datasources';
import { groupIdentifier } from '../../utils/groupIdentifier';

import { useAllRulerRuleAbilityStates } from './ruleAbilities';
import { RuleAction, isApplicable, isNotSupported } from './types';

setupMswServer();

const wrapper = () => getWrapper({ renderWithRouter: true });

/**
 * Render the hook result in a component so we can more reliably check that the
 * result has settled after API requests (avoids loading-state false negatives).
 */
function RenderActionPermissions({ rule, action }: { rule: CombinedRule; action: RuleAction }) {
  const groupId = groupIdentifier.fromCombinedRule(rule);
  const ability = useAllRulerRuleAbilityStates(rule.rulerRule, groupId)[action];
  return (
    <>
      {isApplicable(ability) && 'supported'}
      {ability.granted && 'allowed'}
    </>
  );
}

/**
 * Snapshot tests for rule abilities.
 * Every change to the snapshot should be reviewed carefully!
 */
describe('ruleAbilities', () => {
  it('should report that all actions are applicable for a Grafana Managed alert rule', async () => {
    const rule = getGrafanaRule();
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useAllRulerRuleAbilityStates(rule.rulerRule, groupId), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      const entries = Object.entries(result.current) as Array<
        [RuleAction, ReturnType<typeof useAllRulerRuleAbilityStates>[RuleAction]]
      >;

      for (const [action, ability] of entries) {
        // Create is a list-level action — not applicable on a per-rule instance
        if (action === RuleAction.Create) {
          expect(isNotSupported(ability)).toBe(true);
        } else {
          expect(isApplicable(ability)).toBe(true);
        }
      }
    });

    expect(result.current).toMatchSnapshot();
  });

  it('grants correct silence permissions for folder with silence create permission', async () => {
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: true });

    const rule = getGrafanaRule();

    render(<RenderActionPermissions rule={rule} action={RuleAction.Silence} />);

    expect(await screen.findByText(/supported/)).toBeInTheDocument();
    expect(await screen.findByText(/allowed/)).toBeInTheDocument();
  });

  it('does not grant silence permissions for folder without silence create permission', async () => {
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: false });

    const rule = getGrafanaRule();

    render(<RenderActionPermissions rule={rule} action={RuleAction.Silence} />);

    expect(await screen.findByText(/supported/)).toBeInTheDocument();
    expect(screen.queryByText(/allowed/)).not.toBeInTheDocument();
  });

  it('should report no permissions while loading data for cloud rule', async () => {
    const mimirDs = mockDataSource({ uid: 'mimir', name: 'Mimir' });
    setupDataSources(mimirDs);

    const rule = getCloudRule({}, { rulesSource: mimirDs });
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useAllRulerRuleAbilityStates(rule.rulerRule, groupId), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    expect(result.current).toMatchSnapshot();
  });

  it('should allow editing/deleting rules with plugin origin label when plugin is not installed', async () => {
    const rule = getGrafanaRule({
      labels: { __grafana_origin: 'plugin/non-existent-plugin' },
    });
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useAllRulerRuleAbilityStates(rule.rulerRule, groupId), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      // Wait for abilities to settle — update should be applicable (not loading)
      expect(isApplicable(result.current[RuleAction.Update])).toBe(true);
    });

    // When the plugin is not installed, the rule is editable
    expect(isApplicable(result.current[RuleAction.Update])).toBe(true);
    expect(isApplicable(result.current[RuleAction.Delete])).toBe(true);
  });
});
