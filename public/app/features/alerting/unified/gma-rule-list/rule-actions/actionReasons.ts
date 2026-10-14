import { t } from '@grafana/i18n';

import { managerKindName } from '../rule-data/managerKindName';

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
    reason: t('alerting.rule-actions.reason-provisioned', 'Provisioned'),
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

/**
 * Accessible name of a disabled action. A disabled control is skipped by keyboard navigation and its
 * tooltip only opens on hover or focus, so the reason has to be part of the name to reach assistive tech.
 */
export function unavailableActionLabel(label: string, reason: string | undefined): string {
  return reason
    ? t('alerting.gma-rule-list.actions.unavailable-label', '{{action}}: {{reason}}', { action: label, reason })
    : label;
}
