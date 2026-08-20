import { type RuleIdentifier } from 'app/types/unified-alerting';

import { type RuleFormType } from '../types/rule-form';
import { type PluginRuleRoute } from '../utils/prometheusNavigation';
import { isDataSourceManagedRuleByType, isGrafanaRuleIdentifier, isRecordingRuleByType } from '../utils/rules';

type RuleEditorRouteType = 'recording' | 'alerting' | 'grafana-recording';

/** What Grafana itself renders when the plugin does not take over. */
export type GrafanaEditorPage =
  | { kind: 'refused-create' }
  | { kind: 'refused-edit' }
  | { kind: 'edit'; identifier: RuleIdentifier }
  | { kind: 'clone'; identifier: RuleIdentifier }
  | { kind: 'create' };

export interface RuleEditorRouting {
  grafanaPage: GrafanaEditorPage;
  /** Absent for Grafana-managed requests and requests rejected by source-specific RBAC. */
  pluginHandoff?: PluginRuleRoute;
}

interface RuleEditorAccess {
  canCreateGrafanaRules: boolean;
  canCreateCloudRules: boolean;
  canCreateDataSourceRules: boolean;
  canEditRules: (rulesSourceName: string) => boolean;
}

interface RuleEditorRequest {
  identifier?: RuleIdentifier;
  cloneIdentifier?: RuleIdentifier;
  routeType?: RuleEditorRouteType;
  prefillType?: RuleFormType;
  access: RuleEditorAccess;
}

type RuleOperation = 'edit' | 'clone' | 'create';

/**
 * Keeps source-specific authorization separate from Grafana-form feasibility. The former gates the
 * plugin handoff; the latter only controls the fallback page because the plugin brings its own form.
 */
export function resolveRuleEditorRouting({
  identifier,
  cloneIdentifier,
  routeType,
  prefillType,
  access,
}: RuleEditorRequest): RuleEditorRouting {
  let operation: RuleOperation = 'create';
  if (identifier) {
    operation = 'edit';
  } else if (cloneIdentifier) {
    operation = 'clone';
  }

  const requestIdentifier = identifier ?? cloneIdentifier;
  const isDataSourceManagedRequest = requestIdentifier
    ? !isGrafanaRuleIdentifier(requestIdentifier)
    : routeType === 'recording' || isDataSourceManagedRuleByType(prefillType) || !access.canCreateGrafanaRules;
  const refusal: GrafanaEditorPage = { kind: operation === 'edit' ? 'refused-edit' : 'refused-create' };

  let isAuthorized: boolean;
  if (operation === 'edit') {
    isAuthorized = Boolean(requestIdentifier && access.canEditRules(requestIdentifier.ruleSourceName));
  } else {
    isAuthorized = isDataSourceManagedRequest ? access.canCreateDataSourceRules : access.canCreateGrafanaRules;
  }

  if (!isAuthorized) {
    return { grafanaPage: refusal };
  }

  const canGrafanaHandle = operation === 'edit' || !isDataSourceManagedRequest || access.canCreateCloudRules;

  return {
    grafanaPage: canGrafanaHandle ? grafanaPageFor(operation, requestIdentifier) : refusal,
    pluginHandoff: isDataSourceManagedRequest
      ? pluginHandoffFor(operation, requestIdentifier, routeType, prefillType)
      : undefined,
  };
}

function grafanaPageFor(operation: RuleOperation, identifier?: RuleIdentifier): GrafanaEditorPage {
  if (!identifier) {
    return { kind: 'create' };
  }

  return operation === 'edit' ? { kind: 'edit', identifier } : { kind: 'clone', identifier };
}

function pluginHandoffFor(
  operation: RuleOperation,
  identifier: RuleIdentifier | undefined,
  routeType: RuleEditorRouteType | undefined,
  prefillType: RuleFormType | undefined
): PluginRuleRoute {
  if (identifier && !isGrafanaRuleIdentifier(identifier)) {
    return operation === 'edit' ? { action: 'edit', identifier } : { action: 'clone', identifier };
  }

  const isRecording = routeType === 'recording' || isRecordingRuleByType(prefillType);
  return { action: 'create', ruleType: isRecording ? 'recording' : 'alerting' };
}
