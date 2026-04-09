import { type PropsWithChildren } from 'react';
import { getWrapper, render, renderHook, screen, waitFor } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { setFolderAccessControl } from 'app/features/alerting/unified/mocks/server/configure';
import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import {
  type AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { type CombinedRule } from 'app/types/unified-alerting';

import { getCloudRule, getGrafanaRule, grantUserPermissions, mockDataSource } from '../mocks';
import { AlertmanagerProvider } from '../state/AlertmanagerContext';
import { grantPermissionsHelper } from '../test/test-utils';
import { setupDataSources } from '../testSetup/datasources';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { groupIdentifier } from '../utils/groupIdentifier';
import * as misc from '../utils/misc';

import { useAllRulerRuleAbilityStates, useEnrichmentAbilityState, useEnrichmentAbilityStates } from './useAbilities';
import { AlertmanagerAction, EnrichmentAction, RuleAction } from './useAbilities.types'; // eslint-disable-line sort-imports
import {
  useAlertmanagerAbilityState,
  useAlertmanagerAbilityStates,
  useAllAlertmanagerAbilityStates,
} from './useAlertmanagerAbilities';

/**
 * This test will write snapshots with a record of the current permissions assigned to actions.
 * We encourage that every change to the snapshot is inspected _very_ thoroughly!
 */
describe('alertmanager abilities', () => {
  it("should report Create / Update / Delete actions aren't supported for external vanilla alertmanager", () => {
    setupDataSources(
      mockDataSource<AlertManagerDataSourceJsonData>({
        name: GRAFANA_RULES_SOURCE_NAME,
        type: DataSourceType.Alertmanager,
        jsonData: { implementation: AlertManagerImplementation.prometheus },
      })
    );

    const { result } = renderHook(() => useAllAlertmanagerAbilityStates(), {
      wrapper: createAlertmanagerWrapper('does-not-exist'),
    });
    expect(result.current).toMatchSnapshot();
  });

  it('should report everything is supported for builtin alertmanager', () => {
    setupDataSources(
      mockDataSource<AlertManagerDataSourceJsonData>({
        name: GRAFANA_RULES_SOURCE_NAME,
        type: DataSourceType.Alertmanager,
      })
    );

    grantUserPermissions([AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingInstanceRead]);

    const { result } = renderHook(() => useAllAlertmanagerAbilityStates(), {
      wrapper: createAlertmanagerWrapper(GRAFANA_RULES_SOURCE_NAME),
    });

    Object.values(result.current).forEach(({ supported }) => {
      expect(supported).toBe(true);
    });

    // since we only granted "read" permissions, only those should be allowed
    const { result: viewResult } = renderHook(() => useAlertmanagerAbilityState(AlertmanagerAction.ViewSilence), {
      wrapper: createAlertmanagerWrapper(GRAFANA_RULES_SOURCE_NAME),
    });
    expect(viewResult.current.supported).toBe(true);
    expect(viewResult.current.allowed).toBe(true);

    // editing should not be allowed, but supported
    const { result: editResult } = renderHook(() => useAlertmanagerAbilityState(AlertmanagerAction.ViewSilence), {
      wrapper: createAlertmanagerWrapper(GRAFANA_RULES_SOURCE_NAME),
    });
    expect(editResult.current.supported).toBe(true);
    expect(editResult.current.allowed).toBe(true);

    // record the snapshot to prevent future regressions
    expect(result.current).toMatchSnapshot();
  });

  it('should report everything except exporting for Mimir alertmanager', () => {
    setupDataSources(
      mockDataSource<AlertManagerDataSourceJsonData>({
        name: MIMIR_DATASOURCE_UID,
        type: DataSourceType.Alertmanager,
        jsonData: {
          implementation: AlertManagerImplementation.mimir,
        },
      })
    );

    grantUserPermissions([
      AccessControlAction.AlertingNotificationsExternalRead,
      AccessControlAction.AlertingNotificationsExternalWrite,
      AccessControlAction.AlertingInstancesExternalRead,
      AccessControlAction.AlertingInstancesExternalWrite,
    ]);

    const { result } = renderHook(() => useAllAlertmanagerAbilityStates(), {
      wrapper: createAlertmanagerWrapper('mimir'),
    });

    expect(result.current).toMatchSnapshot();
  });

  it('should be able to return multiple ability states', () => {
    setupDataSources(
      mockDataSource<AlertManagerDataSourceJsonData>({
        name: GRAFANA_RULES_SOURCE_NAME,
        type: DataSourceType.Alertmanager,
      })
    );

    grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);

    const { result } = renderHook(
      () =>
        useAlertmanagerAbilityStates([
          AlertmanagerAction.ViewContactPoint,
          AlertmanagerAction.CreateContactPoint,
          AlertmanagerAction.ExportContactPoint,
        ]),
      {
        wrapper: createAlertmanagerWrapper(GRAFANA_RULES_SOURCE_NAME),
      }
    );

    expect(result.current).toHaveLength(3);
    // ViewContactPoint — supported & allowed (read permission granted)
    expect(result.current[0].supported).toBe(true);
    expect(result.current[0].allowed).toBe(true);
    // CreateContactPoint — supported but not allowed (no write permission)
    expect(result.current[1].supported).toBe(true);
    expect(result.current[1].allowed).toBe(false);
    // ExportContactPoint — supported & allowed (Grafana AM supports export; view ⇒ export)
    expect(result.current[2].supported).toBe(true);
    expect(result.current[2].allowed).toBe(true);
  });
});

setupMswServer();

const wrapper = () => getWrapper({ renderWithRouter: true });

/**
 * Render the hook result in a component so we can more reliably check that the result has settled
 * after API requests. Without this approach, the hook might return loading whilst
 * API requests are still in flight.
 */
const RenderActionPermissions = ({ rule, action }: { rule: CombinedRule; action: RuleAction }) => {
  const groupId = groupIdentifier.fromCombinedRule(rule);
  const result = useAllRulerRuleAbilityStates(rule.rulerRule, groupId);
  const { supported, allowed } = result[action];
  return (
    <>
      {supported && 'supported'}
      {allowed && 'allowed'}
    </>
  );
};

describe('AlertRule abilities', () => {
  it('should report that all actions are supported for a Grafana Managed alert rule', async () => {
    const rule = getGrafanaRule();
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useAllRulerRuleAbilityStates(rule.rulerRule, groupId), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      const results = Object.entries(result.current) as Array<[RuleAction, { supported: boolean }]>;

      for (const [action, { supported }] of results) {
        // Create is a list-level action — not meaningful on a per-rule instance
        if (action === RuleAction.Create) {
          expect(supported).toBe(false);
        } else {
          expect(supported).toBe(true);
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

  it('should report no permissions while we are loading data for cloud rule', async () => {
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
    // Create a rule with a plugin origin label for a plugin that doesn't exist
    const rule = getGrafanaRule({
      labels: { __grafana_origin: 'plugin/non-existent-plugin' },
    });
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useAllRulerRuleAbilityStates(rule.rulerRule, groupId), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      // Wait for the abilities to settle - update should be supported (not loading)
      expect(result.current[RuleAction.Update].supported).toBe(true);
    });

    // When plugin is not installed, these actions should be supported
    expect(result.current[RuleAction.Update].supported).toBe(true);
    expect(result.current[RuleAction.Delete].supported).toBe(true);
  });
});

describe('enrichment abilities', () => {
  setupMswServer();

  const originalFeatureToggle = config.featureToggles.alertEnrichment;

  beforeEach(() => {
    // Default to feature toggle enabled
    config.featureToggles.alertEnrichment = true;
  });

  afterEach(() => {
    config.featureToggles.alertEnrichment = originalFeatureToggle;
  });

  it('should grant read and write permissions to admin users when feature is enabled', () => {
    grantPermissionsHelper([]);
    jest.spyOn(misc, 'isAdmin').mockReturnValue(true);

    const { result } = renderHook(() => useEnrichmentAbilityStates(), { wrapper: wrapper() });

    expect(result.current[EnrichmentAction.Read].supported).toBe(true);
    expect(result.current[EnrichmentAction.Read].allowed).toBe(true);
    expect(result.current[EnrichmentAction.Write].supported).toBe(true);
    expect(result.current[EnrichmentAction.Write].allowed).toBe(true);
  });

  it('should grant read permission when user has enrichments:read permission', () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(false);
    grantPermissionsHelper([AccessControlAction.AlertingEnrichmentsRead]);

    const { result } = renderHook(() => useEnrichmentAbilityStates(), { wrapper: wrapper() });

    expect(result.current[EnrichmentAction.Read].supported).toBe(true);
    expect(result.current[EnrichmentAction.Read].allowed).toBe(true);
    expect(result.current[EnrichmentAction.Write].supported).toBe(true);
    expect(result.current[EnrichmentAction.Write].allowed).toBe(false);
  });

  it('should grant write permission when user has enrichments:write permission', () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(false);
    grantPermissionsHelper([AccessControlAction.AlertingEnrichmentsWrite]);

    const { result } = renderHook(() => useEnrichmentAbilityStates(), { wrapper: wrapper() });

    expect(result.current[EnrichmentAction.Read].supported).toBe(true);
    expect(result.current[EnrichmentAction.Read].allowed).toBe(false);
    expect(result.current[EnrichmentAction.Write].supported).toBe(true);
    expect(result.current[EnrichmentAction.Write].allowed).toBe(true);
  });

  it('should grant both read and write permissions when user has both permissions', () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(false);
    grantPermissionsHelper([AccessControlAction.AlertingEnrichmentsRead, AccessControlAction.AlertingEnrichmentsWrite]);

    const { result } = renderHook(() => useEnrichmentAbilityStates(), { wrapper: wrapper() });

    expect(result.current[EnrichmentAction.Read].supported).toBe(true);
    expect(result.current[EnrichmentAction.Read].allowed).toBe(true);
    expect(result.current[EnrichmentAction.Write].supported).toBe(true);
    expect(result.current[EnrichmentAction.Write].allowed).toBe(true);
  });

  it('should deny all permissions when user is not admin and has no permissions', () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(false);
    grantPermissionsHelper([]);

    const { result } = renderHook(() => useEnrichmentAbilityStates(), { wrapper: wrapper() });

    expect(result.current[EnrichmentAction.Read].supported).toBe(true);
    expect(result.current[EnrichmentAction.Read].allowed).toBe(false);
    expect(result.current[EnrichmentAction.Write].supported).toBe(true);
    expect(result.current[EnrichmentAction.Write].allowed).toBe(false);
  });

  it('should return correct ability state for specific action using useEnrichmentAbilityState', () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(false);
    grantPermissionsHelper([AccessControlAction.AlertingEnrichmentsRead]);

    const { result } = renderHook(() => useEnrichmentAbilityState(EnrichmentAction.Read), { wrapper: wrapper() });

    expect(result.current.supported).toBe(true);
    expect(result.current.allowed).toBe(true);
  });

  it('should report enrichments as not supported when feature toggle is disabled', () => {
    config.featureToggles.alertEnrichment = false;
    jest.spyOn(misc, 'isAdmin').mockReturnValue(true);
    grantPermissionsHelper([AccessControlAction.AlertingEnrichmentsRead, AccessControlAction.AlertingEnrichmentsWrite]);

    const { result } = renderHook(() => useEnrichmentAbilityStates(), { wrapper: wrapper() });

    // Enrichments not supported when feature toggle is off
    expect(result.current[EnrichmentAction.Read].supported).toBe(false);
    expect(result.current[EnrichmentAction.Write].supported).toBe(false);
    // Permissions would be granted if it were supported
    expect(result.current[EnrichmentAction.Read].allowed).toBe(true);
    expect(result.current[EnrichmentAction.Write].allowed).toBe(true);
  });
});

function createAlertmanagerWrapper(alertmanagerSourceName: string) {
  const ProviderWrapper = getWrapper({ renderWithRouter: true });
  const wrapperComponent = (props: PropsWithChildren) => (
    <ProviderWrapper>
      <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={alertmanagerSourceName}>
        {props.children}
      </AlertmanagerProvider>
    </ProviderWrapper>
  );

  return wrapperComponent;
}
