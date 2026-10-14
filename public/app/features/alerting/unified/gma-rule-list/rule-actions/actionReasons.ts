import { t } from '@grafana/i18n';

import { type ActionAvailability } from './ruleActionTypes';

/** The reasons an action is shown disabled, as ready-made availabilities. */

export function checking(): ActionAvailability {
  return { available: false, reason: t('alerting.rule-actions.reason-checking', 'Checking permissions...') };
}

export function unknown(): ActionAvailability {
  return { available: false, reason: t('alerting.rule-actions.reason-unknown', 'Permission unknown') };
}

export function denied(): ActionAvailability {
  return {
    available: false,
    reason: t('alerting.rule-actions.reason-denied', 'You do not have permission to do this'),
  };
}

export function provisioned(): ActionAvailability {
  return {
    available: false,
    reason: t(
      'alerting.rule-actions.reason-provisioned',
      'This rule is provisioned and cannot be edited through the UI'
    ),
  };
}

export function pluginManaged(): ActionAvailability {
  return {
    available: false,
    reason: t(
      'alerting.rule-actions.reason-plugin-managed',
      'This rule is managed by a plugin and cannot be edited through the UI'
    ),
  };
}

export function managed(kind: string): ActionAvailability {
  return {
    available: false,
    reason: t('alerting.rule-actions.reason-managed', 'Managed by {{kind}}', { kind: managerKindName(kind) }),
  };
}

function managerKindName(kind: string) {
  switch (kind) {
    case 'terraform':
      return 'Terraform';
    case 'kubectl':
      return 'kubectl';
    case 'repo':
      return t('alerting.rule-actions.manager-git-sync', 'Git sync');
    case 'classic-file-provisioning':
      return t('alerting.rule-actions.manager-file-provisioning', 'file provisioning');
    case 'classic-api-provisioning':
      return t('alerting.rule-actions.manager-provisioning-api', 'the provisioning API');
    case 'classic-converted-prometheus':
      return t('alerting.rule-actions.manager-prometheus-import', 'Prometheus import');
    default:
      return kind;
  }
}
