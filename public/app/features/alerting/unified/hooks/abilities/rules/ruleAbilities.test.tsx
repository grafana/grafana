import { getWrapper, render, renderHook, screen, waitFor } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';
import { type GrafanaPromRuleDTO, PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../../mockApi';
import { getCloudRule, getGrafanaRule, grantUserPermissions, mockDataSource } from '../../../mocks';
import { setFolderAccessControl } from '../../../mocks/server/configure';
import { setupDataSources } from '../../../testSetup/datasources';
import { groupIdentifier } from '../../../utils/groupIdentifier';
import * as misc from '../../../utils/misc';
import { isLoading, isNotSupported, isPluginManaged, isProvisioned, isSupported } from '../abilityUtils';
import { ExternalRuleAction, RuleAction, isInsufficientPermissions } from '../types';

import {
  usePromRuleAdministrationAbility,
  usePromRuleExportAbility,
  usePromRuleSilenceAbility,
} from './promRuleAbilities';
import {
  useExternalGlobalRuleAbilities,
  useExternalGlobalRuleAbility,
  useGlobalRuleAbilities,
  useRuleExploreAbility,
} from './ruleAbilities';
import {
  buildSilenceAbility,
  computeRuleDuplicateAbility,
  computeRuleEditAbility,
  skipToken,
} from './ruleAbilities.utils';
import { useRuleAdministrationAbility, useRuleExportAbility, useRuleSilenceAbility } from './rulerRuleAbilities';

setupMswServer();

const wrapper = () => getWrapper({ renderWithRouter: true });

// ── useRuleAdministrationAbility ────────────────────────────────────────────────────────

describe('useRuleAdministrationAbility', () => {
  it('returns loading state while async checks are in flight', async () => {
    const rule = getGrafanaRule();
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useRuleAdministrationAbility(rule.rulerRule, groupId), { wrapper: wrapper() });

    // Initially loading
    expect(isLoading(result.current.update)).toBe(true);
    expect(result.current.loading).toBe(true);

    // Settles after API resolves
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('grants update and delete when user has permissions and ruler is available', async () => {
    setFolderAccessControl({
      'alert.rules:write': true,
      'alert.rules:delete': true,
    });

    const rule = getGrafanaRule();
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useRuleAdministrationAbility(rule.rulerRule, groupId), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.update.granted).toBe(true);
    expect(result.current.delete.granted).toBe(true);
  });

  it('matches snapshot for a Grafana rule with all permissions granted', async () => {
    setFolderAccessControl({
      'alert.rules:write': true,
      'alert.rules:delete': true,
    });
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);

    const rule = getGrafanaRule();
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useRuleAdministrationAbility(rule.rulerRule, groupId), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current).toMatchSnapshot();
  });

  it('matches snapshot for a cloud rule in loading state', async () => {
    const mimirDs = mockDataSource({ uid: 'mimir', name: 'Mimir' });
    setupDataSources(mimirDs);

    const rule = getCloudRule({}, { rulesSource: mimirDs });
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useRuleAdministrationAbility(rule.rulerRule, groupId), { wrapper: wrapper() });

    // Snapshot the initial loading state before the ruler resolves
    expect(result.current).toMatchSnapshot();
  });

  it('returns INSUFFICIENT_PERMISSIONS when user lacks folder edit permission', async () => {
    // setFolderAccessControl without write/delete → both denied with the right permissions listed
    setFolderAccessControl({ 'alert.rules:write': false, 'alert.rules:delete': false });

    const rule = getGrafanaRule();
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useRuleAdministrationAbility(rule.rulerRule, groupId), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(isInsufficientPermissions(result.current.update)).toBe(true);
    if (isInsufficientPermissions(result.current.update)) {
      expect(result.current.update.anyOfPermissions).toContain(AccessControlAction.AlertingRuleUpdate);
    }

    expect(isInsufficientPermissions(result.current.delete)).toBe(true);
    if (isInsufficientPermissions(result.current.delete)) {
      expect(result.current.delete.anyOfPermissions).toContain(AccessControlAction.AlertingRuleDelete);
    }
  });

  it('returns PROVISIONED for provisioned Grafana rules — duplicate remains grantable', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);

    const rule = getGrafanaRule();
    if (rule.rulerRule && 'grafana_alert' in rule.rulerRule) {
      (rule.rulerRule as { grafana_alert: { provenance: string } }).grafana_alert.provenance = 'terraform';
    }
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useRuleAdministrationAbility(rule.rulerRule, groupId), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(isProvisioned(result.current.update)).toBe(true);
    expect(isProvisioned(result.current.delete)).toBe(true);
    // duplicate is intentionally NOT blocked by provisioning — a provisioned rule
    // can be copied to create a new editable one
    expect(result.current.duplicate.granted).toBe(true);
    expect(result.current).toMatchSnapshot();
  });

  it('is editable (not IS_PLUGIN_MANAGED) when plugin origin label references a non-existent plugin', async () => {
    setFolderAccessControl({ 'alert.rules:write': true });

    const rule = getGrafanaRule({
      labels: { __grafana_origin: 'plugin/non-existent-plugin' },
    });
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useRuleAdministrationAbility(rule.rulerRule, groupId), { wrapper: wrapper() });

    await waitFor(() => expect(isSupported(result.current.update)).toBe(true));

    // Non-existent plugin → isPluginManaged=false → editable
    expect(result.current.update.granted).toBe(true);
    expect(isPluginManaged(result.current.duplicate)).toBe(false);
  });

  it('returns NOT_SUPPORTED for cloud rules (ruler unavailable while loading)', async () => {
    const mimirDs = mockDataSource({ uid: 'mimir', name: 'Mimir' });
    setupDataSources(mimirDs);

    const rule = getCloudRule({}, { rulesSource: mimirDs });
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useRuleAdministrationAbility(rule.rulerRule, groupId), { wrapper: wrapper() });

    await waitFor(() => expect(result.current).not.toBeUndefined());

    // Cloud rules without a connected ruler → NOT_SUPPORTED after loading
    expect(isSupported(result.current.update)).toBe(false);
  });

  it('returns NOT_SUPPORTED for restore and pause when rule is not Grafana-managed', async () => {
    const mimirDs = mockDataSource({ uid: 'mimir', name: 'Mimir' });
    setupDataSources(mimirDs);

    const rule = getCloudRule({}, { rulesSource: mimirDs });
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useRuleAdministrationAbility(rule.rulerRule, groupId), { wrapper: wrapper() });

    await waitFor(() => expect(result.current).not.toBeUndefined());

    expect(isNotSupported(result.current.restore)).toBe(true);
    expect(isNotSupported(result.current.pause)).toBe(true);
  });

  it('grants restore and pause for Grafana-managed rules with edit permission', async () => {
    setFolderAccessControl({ 'alert.rules:write': true });

    const rule = getGrafanaRule();
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useRuleAdministrationAbility(rule.rulerRule, groupId), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.restore.granted).toBe(true);
    expect(result.current.pause.granted).toBe(true);
  });

  it('returns IS_PLUGIN_MANAGED for duplicate when rule is plugin-managed', async () => {
    // With a real installed plugin, duplicate would return IsPluginManaged.
    // We verify the NOT-installed path returns granted (not plugin-managed).
    const rule = getGrafanaRule({
      labels: { __grafana_origin: 'plugin/non-existent-plugin' },
    });
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useRuleAdministrationAbility(rule.rulerRule, groupId), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Non-existent plugin → not plugin-managed → duplicate checks create permission
    expect(isPluginManaged(result.current.duplicate)).toBe(false);
  });

  it('returns NOT_SUPPORTED for deletePermanently when rule is not Grafana-managed', async () => {
    const mimirDs = mockDataSource({ uid: 'mimir', name: 'Mimir' });
    setupDataSources(mimirDs);

    const rule = getCloudRule({}, { rulesSource: mimirDs });
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useRuleAdministrationAbility(rule.rulerRule, groupId), { wrapper: wrapper() });

    await waitFor(() => expect(result.current).not.toBeUndefined());

    expect(isNotSupported(result.current.deletePermanently)).toBe(true);
  });

  it('returns INSUFFICIENT_PERMISSIONS for deletePermanently when user has delete permission but is not admin', async () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(false);
    setFolderAccessControl({ 'alert.rules:write': true, 'alert.rules:delete': true });

    const rule = getGrafanaRule();
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useRuleAdministrationAbility(rule.rulerRule, groupId), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.delete.granted).toBe(true);
    expect(isInsufficientPermissions(result.current.deletePermanently)).toBe(true);
    if (isInsufficientPermissions(result.current.deletePermanently)) {
      // Admin is a role, not a grantable permission — the list is intentionally empty.
      expect(result.current.deletePermanently.anyOfPermissions).toHaveLength(0);
    }
  });

  it('grants deletePermanently when user has delete permission and is admin', async () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(true);
    setFolderAccessControl({ 'alert.rules:write': true, 'alert.rules:delete': true });

    const rule = getGrafanaRule();
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useRuleAdministrationAbility(rule.rulerRule, groupId), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.deletePermanently.granted).toBe(true);
  });

  it('propagates underlying cause to deletePermanently when delete is denied', async () => {
    // Provisioned rules: delete → PROVISIONED, so deletePermanently should also → PROVISIONED
    const rule = getGrafanaRule();
    if (rule.rulerRule && 'grafana_alert' in rule.rulerRule) {
      (rule.rulerRule as { grafana_alert: { provenance: string } }).grafana_alert.provenance = 'terraform';
    }
    const groupId = groupIdentifier.fromCombinedRule(rule);

    const { result } = renderHook(() => useRuleAdministrationAbility(rule.rulerRule, groupId), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(isProvisioned(result.current.delete)).toBe(true);
    expect(isProvisioned(result.current.deletePermanently)).toBe(true);
  });
});

// ── useRuleSilenceAbility ─────────────────────────────────────────────────────

describe('useRuleSilenceAbility', () => {
  it('grants silence when user has folder silence create permission', async () => {
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: true });

    const rule = getGrafanaRule();

    render(<RenderSilence rule={rule} />);

    expect(await screen.findByText(/applicable/)).toBeInTheDocument();
    expect(await screen.findByText(/granted/)).toBeInTheDocument();
  });

  it('denies silence when folder lacks silence create permission', async () => {
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: false });

    const rule = getGrafanaRule();

    render(<RenderSilence rule={rule} />);

    expect(await screen.findByText(/applicable/)).toBeInTheDocument();
    expect(screen.queryByText(/granted/)).not.toBeInTheDocument();
  });

  it('matches snapshot for denied silence — freezes the anyOfPermissions list', async () => {
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: false });
    // No global silence permission either
    grantUserPermissions([]);

    const rule = getGrafanaRule();

    const { result } = renderHook(() => useRuleSilenceAbility(rule.rulerRule), { wrapper: wrapper() });

    // Wait for folder metadata to resolve so we get INSUFFICIENT_PERMISSIONS, not LOADING
    await waitFor(() => expect(isLoading(result.current)).toBe(false));

    expect(result.current).toMatchSnapshot();
  });
});

function RenderSilence({ rule }: { rule: ReturnType<typeof getGrafanaRule> }) {
  // Silence uses the ruler rule's folder UID
  const silenceAbility = useRuleSilenceAbility(rule.rulerRule);
  return (
    <>
      {isSupported(silenceAbility) && 'applicable'}
      {silenceAbility.granted && 'granted'}
    </>
  );
}

// ── useRuleExploreAbility ─────────────────────────────────────────────────────

describe('useRuleExploreAbility', () => {
  it('grants explore when user has DataSourcesExplore permission', () => {
    grantUserPermissions([AccessControlAction.DataSourcesExplore]);

    const { result } = renderHook(() => useRuleExploreAbility(), { wrapper: wrapper() });

    // Synchronous — no async needed
    expect(result.current.granted).toBe(true);
  });

  it('returns INSUFFICIENT_PERMISSIONS when user lacks DataSourcesExplore', () => {
    grantUserPermissions([]);

    const { result } = renderHook(() => useRuleExploreAbility(), { wrapper: wrapper() });

    expect(isInsufficientPermissions(result.current)).toBe(true);
    if (isInsufficientPermissions(result.current)) {
      expect(result.current.anyOfPermissions).toContain(AccessControlAction.DataSourcesExplore);
    }
    // Snapshot freezes that exactly one permission is listed (not zero, not two)
    expect(result.current).toMatchSnapshot();
  });
});

// ── useRuleExportAbility ──────────────────────────────────────────────────────

describe('useRuleExportAbility', () => {
  it('is applicable for Grafana-managed rules', () => {
    const rule = getGrafanaRule();

    const { result } = renderHook(() => useRuleExportAbility(rule.rulerRule), { wrapper: wrapper() });

    expect(isSupported(result.current)).toBe(true);
  });

  it('returns NOT_SUPPORTED for cloud rules', () => {
    const mimirDs = mockDataSource({ uid: 'mimir', name: 'Mimir' });
    setupDataSources(mimirDs);

    const rule = getCloudRule({}, { rulesSource: mimirDs });

    const { result } = renderHook(() => useRuleExportAbility(rule.rulerRule), { wrapper: wrapper() });

    expect(isNotSupported(result.current)).toBe(true);
  });
});

// ── useRuleAdministrationAbility ─────────────────────────────────────────

/** Build a minimal GrafanaPromRuleDTO for testing */
function makePromRule(overrides?: Partial<GrafanaPromRuleDTO>): GrafanaPromRuleDTO {
  const rule = getGrafanaRule();
  const rulerRule = rule.rulerRule!;
  const folderUid =
    'grafana_alert' in rulerRule
      ? (rulerRule as { grafana_alert: { namespace_uid: string } }).grafana_alert.namespace_uid
      : '';
  return {
    name: 'test rule',
    query: '{}',
    uid: 'test-uid',
    folderUid,
    isPaused: false,
    health: 'ok',
    state: PromAlertingRuleState.Inactive,
    type: PromRuleType.Alerting,
    totals: {},
    totalsFiltered: {},
    ...overrides,
  };
}

describe('usePromRuleAdministrationAbility', () => {
  it('returns all NOT_SUPPORTED when skipToken is passed', () => {
    const { result } = renderHook(() => usePromRuleAdministrationAbility(skipToken), { wrapper: wrapper() });

    expect(isNotSupported(result.current.update)).toBe(true);
    expect(isNotSupported(result.current.delete)).toBe(true);
    expect(isNotSupported(result.current.deletePermanently)).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('returns NOT_SUPPORTED for deletePermanently when rule is a recording rule', async () => {
    const promRule = makePromRule({ type: PromRuleType.Recording });

    const { result } = renderHook(() => usePromRuleAdministrationAbility(promRule), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(isNotSupported(result.current.deletePermanently)).toBe(true);
  });

  it('returns INSUFFICIENT_PERMISSIONS for deletePermanently when user has delete permission but is not admin', async () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(false);
    setFolderAccessControl({ 'alert.rules:write': true, 'alert.rules:delete': true });

    const promRule = makePromRule();

    const { result } = renderHook(() => usePromRuleAdministrationAbility(promRule), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.delete.granted).toBe(true);
    expect(isInsufficientPermissions(result.current.deletePermanently)).toBe(true);
    if (isInsufficientPermissions(result.current.deletePermanently)) {
      // Admin is a role, not a grantable permission — the list is intentionally empty.
      expect(result.current.deletePermanently.anyOfPermissions).toHaveLength(0);
    }
  });

  it('grants deletePermanently when user has delete permission and is admin', async () => {
    jest.spyOn(misc, 'isAdmin').mockReturnValue(true);
    setFolderAccessControl({ 'alert.rules:write': true, 'alert.rules:delete': true });

    const promRule = makePromRule();

    const { result } = renderHook(() => usePromRuleAdministrationAbility(promRule), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.deletePermanently.granted).toBe(true);
  });

  it('propagates underlying cause to deletePermanently when delete is denied', async () => {
    // Provisioned alerting rule: delete → PROVISIONED, deletePermanently should also → PROVISIONED
    // isProvisionedPromRule checks promRule.provenance directly.
    const promRule = makePromRule({ provenance: 'terraform' });

    const { result } = renderHook(() => usePromRuleAdministrationAbility(promRule), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(isProvisioned(result.current.delete)).toBe(true);
    expect(isProvisioned(result.current.deletePermanently)).toBe(true);
  });
});

// ── usePromRuleSilenceAbility ─────────────────────────────────────────────────

describe('usePromRuleSilenceAbility', () => {
  it('denies silence for skipToken — not an alerting rule', async () => {
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: false });
    grantUserPermissions([]);

    const { result } = renderHook(() => usePromRuleSilenceAbility(skipToken), { wrapper: wrapper() });

    await waitFor(() => expect(isLoading(result.current)).toBe(false));

    expect(isInsufficientPermissions(result.current)).toBe(true);
  });

  it('denies silence for a recording rule — isAlertingRule is false', async () => {
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: true });

    const promRule = makePromRule({ type: PromRuleType.Recording });

    const { result } = renderHook(() => usePromRuleSilenceAbility(promRule), { wrapper: wrapper() });

    await waitFor(() => expect(isLoading(result.current)).toBe(false));

    expect(isInsufficientPermissions(result.current)).toBe(true);
  });

  it('grants silence for an alerting rule when user has folder silence create permission', async () => {
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: true });

    const promRule = makePromRule();

    const { result } = renderHook(() => usePromRuleSilenceAbility(promRule), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.granted).toBe(true));
  });

  it('denies silence for an alerting rule when folder lacks silence permission', async () => {
    setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: false });
    grantUserPermissions([]);

    const promRule = makePromRule();

    const { result } = renderHook(() => usePromRuleSilenceAbility(promRule), { wrapper: wrapper() });

    await waitFor(() => expect(isLoading(result.current)).toBe(false));

    expect(isInsufficientPermissions(result.current)).toBe(true);
  });
});

// ── usePromRuleExportAbility ──────────────────────────────────────────────────

describe('usePromRuleExportAbility', () => {
  it('returns NOT_SUPPORTED for skipToken', () => {
    const { result } = renderHook(() => usePromRuleExportAbility(skipToken), { wrapper: wrapper() });

    expect(isNotSupported(result.current)).toBe(true);
  });

  it('returns NOT_SUPPORTED for a recording rule', () => {
    const promRule = makePromRule({ type: PromRuleType.Recording });

    const { result } = renderHook(() => usePromRuleExportAbility(promRule), { wrapper: wrapper() });

    expect(isNotSupported(result.current)).toBe(true);
  });

  it('is available and granted for an alerting rule with read permission', () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);

    const promRule = makePromRule();

    const { result } = renderHook(() => usePromRuleExportAbility(promRule), { wrapper: wrapper() });

    expect(isSupported(result.current)).toBe(true);
    expect(result.current.granted).toBe(true);
  });
});

// ── Global rule ability React hooks ──────────────────────────────────────────

describe('useGlobalRuleAbilities (React hook)', () => {
  it('returns granted abilities matching held permissions', () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleCreate]);

    const { result } = renderHook(() => useGlobalRuleAbilities(), { wrapper: wrapper() });

    expect(result.current[RuleAction.View].granted).toBe(true);
    expect(result.current[RuleAction.Create].granted).toBe(true);
    expect(result.current[RuleAction.Update].granted).toBe(false);
    // Per-instance actions are NOT_SUPPORTED at list level
    expect(isNotSupported(result.current[RuleAction.Duplicate])).toBe(true);
  });
});

describe('useExternalGlobalRuleAbilities (React hook)', () => {
  it('returns granted abilities matching held permissions', () => {
    grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);

    const { result } = renderHook(() => useExternalGlobalRuleAbilities(), { wrapper: wrapper() });

    expect(result.current[ExternalRuleAction.ViewAlertRule].granted).toBe(true);
    expect(result.current[ExternalRuleAction.CreateAlertRule].granted).toBe(false);
  });
});

describe('useExternalGlobalRuleAbility (React hook)', () => {
  it('grants view when external read permission is held', () => {
    grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);

    const { result } = renderHook(() => useExternalGlobalRuleAbility(ExternalRuleAction.ViewAlertRule), {
      wrapper: wrapper(),
    });

    expect(result.current.granted).toBe(true);
  });

  it('denies create when external write permission is not held', () => {
    grantUserPermissions([]);

    const { result } = renderHook(() => useExternalGlobalRuleAbility(ExternalRuleAction.CreateAlertRule), {
      wrapper: wrapper(),
    });

    expect(isInsufficientPermissions(result.current)).toBe(true);
    if (isInsufficientPermissions(result.current)) {
      expect(result.current.anyOfPermissions).toContain(AccessControlAction.AlertingRuleExternalWrite);
    }
  });
});

// ── Pure utility function branches ────────────────────────────────────────────

describe('buildSilenceAbility', () => {
  it('returns NOT_SUPPORTED when silence is not supported by the alertmanager', () => {
    expect(isNotSupported(buildSilenceAbility(false, false, true))).toBe(true);
  });
});

describe('computeRuleEditAbility', () => {
  it('returns NOT_SUPPORTED when the ruler endpoint is unavailable (supported=false)', () => {
    const result = computeRuleEditAbility(
      false,
      false, // supported = false
      false,
      false,
      false,
      true,
      AccessControlAction.AlertingRuleUpdate
    );
    expect(isNotSupported(result)).toBe(true);
  });

  it('returns IS_PLUGIN_MANAGED when the rule is owned by an installed plugin', () => {
    const result = computeRuleEditAbility(
      false,
      true,
      false, // not provisioned
      false, // not federated
      true, // isPluginManaged = true
      true,
      AccessControlAction.AlertingRuleUpdate
    );
    expect(isPluginManaged(result)).toBe(true);
  });
});

describe('computeRuleDuplicateAbility', () => {
  it('returns IS_PLUGIN_MANAGED when the rule is owned by an installed plugin', () => {
    const result = computeRuleDuplicateAbility(
      false,
      true, // isPluginManaged = true
      AccessControlAction.AlertingRuleCreate
    );
    expect(isPluginManaged(result)).toBe(true);
  });
});
