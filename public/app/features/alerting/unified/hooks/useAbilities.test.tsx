import { getWrapper, render, renderHook, screen, waitFor } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { setFolderAccessControl } from 'app/features/alerting/unified/mocks/server/configure';
import { AccessControlAction } from 'app/types/accessControl';
import { type CombinedRule } from 'app/types/unified-alerting';

import { getGrafanaRule } from '../mocks';

import { AlertRuleAction, useAlertRuleAbility } from './useAbilities';

setupMswServer();

const wrapper = () => getWrapper({ renderWithRouter: true });

/**
 * Render the hook result in a component so we can more reliably check that the result has settled
 * after API requests. Without this approach, the hook might return `[false, false]` whilst
 * API requests are still loading
 */
const RenderActionPermissions = ({ rule, action }: { rule: CombinedRule; action: AlertRuleAction }) => {
  const [isSupported, isAllowed] = useAlertRuleAbility(rule, action);
  return (
    <>
      {isSupported && 'supported'}
      {isAllowed && 'allowed'}
    </>
  );
};

describe('AlertRule abilities', () => {
  it('grants correct silence permissions for folder with silence create permission', async () => {
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: true });

    const rule = getGrafanaRule();

    render(<RenderActionPermissions rule={rule} action={AlertRuleAction.Silence} />);

    expect(await screen.findByText(/supported/)).toBeInTheDocument();
    expect(await screen.findByText(/allowed/)).toBeInTheDocument();
  });

  it('does not grant silence permissions for folder without silence create permission', async () => {
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: false });

    const rule = getGrafanaRule();

    render(<RenderActionPermissions rule={rule} action={AlertRuleAction.Silence} />);

    expect(await screen.findByText(/supported/)).toBeInTheDocument();
    expect(screen.queryByText(/allowed/)).not.toBeInTheDocument();
  });

  it('should allow editing/deleting rules with plugin origin label when plugin is not installed', async () => {
    // Create a rule with a plugin origin label for a plugin that doesn't exist
    const rule = getGrafanaRule({
      labels: { __grafana_origin: 'plugin/non-existent-plugin' },
    });

    const { result: updateResult } = renderHook(() => useAlertRuleAbility(rule, AlertRuleAction.Update), {
      wrapper: wrapper(),
    });
    const { result: deleteResult } = renderHook(() => useAlertRuleAbility(rule, AlertRuleAction.Delete), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      // Wait for the abilities to settle - update should be supported (not loading)
      const [updateSupported] = updateResult.current;
      expect(updateSupported).toBe(true);
    });

    // When plugin is not installed, these actions should be supported
    const [updateSupported] = updateResult.current;
    const [deleteSupported] = deleteResult.current;

    expect(updateSupported).toBe(true);
    expect(deleteSupported).toBe(true);
  });
});
