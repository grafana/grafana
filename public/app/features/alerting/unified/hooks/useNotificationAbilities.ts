import { useMemo } from 'react';

import { contextSrv as ctx } from 'app/core/services/context_srv';
import {
  PERMISSIONS_CONTACT_POINTS_MODIFY,
  PERMISSIONS_CONTACT_POINTS_READ,
} from 'app/features/alerting/unified/components/contact-points/permissions';
import {
  PERMISSIONS_TIME_INTERVALS_MODIFY,
  PERMISSIONS_TIME_INTERVALS_READ,
} from 'app/features/alerting/unified/components/mute-timings/permissions';
import {
  PERMISSIONS_NOTIFICATION_POLICIES_MODIFY,
  PERMISSIONS_NOTIFICATION_POLICIES_READ,
} from 'app/features/alerting/unified/components/notification-policies/permissions';
import { AccessControlAction } from 'app/types/accessControl';

import { getInstancesPermissions, instancesPermissions, notificationsPermissions } from '../utils/access-control';

/**
 * Context-free permission helpers for the notification domain.
 *
 * These hooks do NOT require AlertmanagerContext and can be used anywhere in the app.
 * They check permissions against the Grafana-flavored alertmanager's granular permission
 * set (alerting.receivers:*, alerting.routes:*, etc.) as well as the legacy coarse-grained
 * alerting.notifications:* permissions.
 *
 * For abilities that require knowing which alertmanager is selected (e.g. whether the
 * configuration API is available), use useAlertmanagerAbility() instead.
 */

// ── Contact points ────────────────────────────────────────────────────────────

/** Returns true if the user can view contact points. */
export function useCanViewContactPoints(): boolean {
  return useMemo(
    () =>
      ctx.hasPermission(notificationsPermissions.read.grafana) ||
      PERMISSIONS_CONTACT_POINTS_READ.some((action) => ctx.hasPermission(action)),
    []
  );
}

/** Returns true if the user can create a new contact point. */
export function useCanCreateContactPoint(): boolean {
  return useMemo(
    () =>
      ctx.hasPermission(notificationsPermissions.create.grafana) ||
      ctx.hasPermission(AccessControlAction.AlertingReceiversCreate),
    []
  );
}

/** Returns true if the user can edit an existing contact point. */
export function useCanEditContactPoint(): boolean {
  return useMemo(
    () =>
      ctx.hasPermission(notificationsPermissions.update.grafana) ||
      PERMISSIONS_CONTACT_POINTS_MODIFY.some((action) => ctx.hasPermission(action)),
    []
  );
}

/** Returns true if the user can delete a contact point. */
export function useCanDeleteContactPoint(): boolean {
  return useMemo(
    () =>
      ctx.hasPermission(notificationsPermissions.delete.grafana) ||
      ctx.hasPermission(AccessControlAction.AlertingReceiversWrite),
    []
  );
}

// ── Templates ────────────────────────────────────────────────────────────────

/** Returns true if the user can view notification templates. */
export function useCanViewTemplates(): boolean {
  return useMemo(
    () =>
      ctx.hasPermission(notificationsPermissions.read.grafana) ||
      ctx.hasPermission(AccessControlAction.AlertingTemplatesRead),
    []
  );
}

/** Returns true if the user can create or edit notification templates. */
export function useCanEditTemplates(): boolean {
  return useMemo(
    () =>
      ctx.hasPermission(notificationsPermissions.update.grafana) ||
      ctx.hasPermission(AccessControlAction.AlertingTemplatesWrite),
    []
  );
}

// ── Notification policies ─────────────────────────────────────────────────────

/** Returns true if the user can view the notification policy tree. */
export function useCanViewNotificationPolicies(): boolean {
  return useMemo(
    () =>
      ctx.hasPermission(notificationsPermissions.read.grafana) ||
      PERMISSIONS_NOTIFICATION_POLICIES_READ.some((action) => ctx.hasPermission(action)),
    []
  );
}

/** Returns true if the user can create, update or delete notification policies. */
export function useCanEditNotificationPolicies(): boolean {
  return useMemo(
    () =>
      ctx.hasPermission(notificationsPermissions.update.grafana) ||
      PERMISSIONS_NOTIFICATION_POLICIES_MODIFY.some((action) => ctx.hasPermission(action)),
    []
  );
}

// ── Time intervals ────────────────────────────────────────────────────────────

/** Returns true if the user can view time intervals (mute timings). */
export function useCanViewTimeIntervals(): boolean {
  return useMemo(
    () =>
      ctx.hasPermission(notificationsPermissions.read.grafana) ||
      PERMISSIONS_TIME_INTERVALS_READ.some((action) => ctx.hasPermission(action)),
    []
  );
}

/** Returns true if the user can create, update or delete time intervals. */
export function useCanEditTimeIntervals(): boolean {
  return useMemo(
    () =>
      ctx.hasPermission(notificationsPermissions.update.grafana) ||
      PERMISSIONS_TIME_INTERVALS_MODIFY.some((action) => ctx.hasPermission(action)),
    []
  );
}

// ── Templates (test) ──────────────────────────────────────────────────────────

/**
 * Returns true if the user can test (preview) notification templates.
 * Requires either the specific templates-test permission or the broader notifications write permission.
 */
export function useCanTestTemplates(): boolean {
  return useMemo(
    () =>
      ctx.hasPermission(AccessControlAction.AlertingNotificationsTemplatesTest) ||
      ctx.hasPermission(notificationsPermissions.update.grafana),
    []
  );
}

// ── Silences ──────────────────────────────────────────────────────────────────

/**
 * Returns true if the user can create silences.
 *
 * This checks the global AlertingInstanceCreate permission only.
 * For folder-scoped silence creation checks, use useCanSilenceInFolder() in useAbilities.ts.
 */
export function useCanCreateSilences(): boolean {
  return useMemo(() => ctx.hasPermission(AccessControlAction.AlertingInstanceCreate), []);
}

/** Returns true if the user can view silences. */
export function useCanViewSilences(): boolean {
  return useMemo(() => ctx.hasPermission(instancesPermissions.read.grafana), []);
}

/**
 * Returns true if the user can create silences for the given alertmanager source.
 * Handles both Grafana-managed (AlertingInstanceCreate) and external alertmanagers
 * (AlertingInstancesExternalWrite).
 */
export function useCanCreateSilencesForAM(alertManagerSourceName: string): boolean {
  return useMemo(() => {
    const permissions = getInstancesPermissions(alertManagerSourceName);
    return ctx.hasPermission(permissions.create);
  }, [alertManagerSourceName]);
}
