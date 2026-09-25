import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { hasAny } from 'app/core/navtree/utils';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import {
  PERMISSIONS_CONTACT_POINTS,
  PERMISSIONS_NOTIFICATION_POLICIES,
  PERMISSIONS_TEMPLATES,
  PERMISSIONS_TIME_INTERVALS,
  notificationsPermissions,
} from './alertmanagerPermissions';

// Page-level access predicates for the alerting section, gating nav items and —
// via the same predicate — route guards, so the two can't drift apart. Keep this
// a leaf module: the nav tree builder calls these during redux store creation,
// before the ability system is safe to touch.

const isAlertingV2 = () => getFeatureFlagClient().getBooleanValue(FlagKeys.AlertingNavigationV2, true);
const isAlertingTriage = () => getFeatureFlagClient().getBooleanValue(FlagKeys.AlertingTriage, false);

// The history page is only available when state-history queries are served by
// Loki: either as the only backend, or as the primary of the "multiple"
// backend. Values are trimmed and compared case-insensitively to match Go's
// isStateHistoryBackend, so `backend = Loki` is recognised too.
const isStateHistoryBackend = (value: string | undefined, backend: string) => value?.trim().toLowerCase() === backend;

const stateHistoryServedByLoki = () => {
  const stateHistory = config.unifiedAlerting.stateHistory;
  return isStateHistoryBackend(stateHistory?.backend, 'multiple')
    ? isStateHistoryBackend(stateHistory?.primary, 'loki')
    : isStateHistoryBackend(stateHistory?.backend, 'loki');
};

// Reused from the ability system's sets so the two can't drift. Slightly wider
// than the server's nav gate, which asks for read actions only.
const alertInstanceAccess = () =>
  hasAny(AccessControlAction.AlertingInstanceRead, AccessControlAction.AlertingInstancesExternalRead);

const contactPointsPermissions = () =>
  hasAny(
    ...PERMISSIONS_CONTACT_POINTS,
    ...PERMISSIONS_TEMPLATES,
    // Neither set covers external alertmanagers or the secrets read
    notificationsPermissions.read.external,
    AccessControlAction.AlertingReceiversReadSecrets
  );

const notificationPoliciesPermissions = () =>
  hasAny(...PERMISSIONS_NOTIFICATION_POLICIES, ...PERMISSIONS_TIME_INTERVALS, notificationsPermissions.read.external);

/** Whether the alerting section itself is available */
export const alertingEnabled = () => config.unifiedAlertingEnabled;

export const alertRulesAccess = () =>
  hasAny(AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleExternalRead);

/** V2 navigation groups alert activity and groups under one page (tabs managed on the frontend) */
export const alertActivityAccess = () =>
  isAlertingTriage() && isAlertingV2() && (alertRulesAccess() || alertInstanceAccess());

export const legacyAlertActivityAccess = () => isAlertingTriage() && !isAlertingV2() && alertRulesAccess();

export const notificationConfigAccess = () =>
  isAlertingV2() && (contactPointsPermissions() || notificationPoliciesPermissions());

export const contactPointsAccess = () => !isAlertingV2() && contactPointsPermissions();

export const notificationPoliciesAccess = () => !isAlertingV2() && notificationPoliciesPermissions();

export const silencesAccess = () =>
  hasAny(
    AccessControlAction.AlertingInstanceRead,
    AccessControlAction.AlertingInstancesExternalRead,
    AccessControlAction.AlertingSilenceRead
  );

/** In V2 navigation with triage enabled, Alert groups is shown as a tab under Alert activity */
export const activeNotificationsAccess = () => alertInstanceAccess() && !(isAlertingV2() && isAlertingTriage());

export const historyAccess = () =>
  stateHistoryServedByLoki() && contextSrv.hasPermission(AccessControlAction.AlertingRuleRead);

export const recentlyDeletedAccess = () =>
  contextSrv.hasRole('Admin') &&
  getFeatureFlagClient().getBooleanValue(FlagKeys.AlertRuleRestore, true) &&
  getFeatureFlagClient().getBooleanValue(FlagKeys.AlertingRuleRecoverDeleted, true) &&
  !isAlertingV2();

export const alertingAdminAccess = () => contextSrv.hasRole('Admin');

export const newAlertRuleAccess = () =>
  hasAny(AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingRuleExternalWrite);

/** V2 navigation renders rules with frontend-managed tabs under a different nav id */
export const alertRulesNavId = () => (isAlertingV2() ? 'alert-rules' : 'alert-list');
