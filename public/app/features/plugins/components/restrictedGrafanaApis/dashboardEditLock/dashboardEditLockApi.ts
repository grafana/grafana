/**
 * Dashboard Edit Lock API — restricted API wrapper.
 *
 * Lets allowlisted plugins block manual dashboard interaction while they
 * programmatically edit the open dashboard (e.g. the assistant's dashboarding
 * agent mutating the live scene), so concurrent user edits cannot corrupt the
 * dashboard. The lock UI (dim overlay + progress pill) is rendered by
 * DashboardEditLockHost; this module only delegates to its store.
 */

import type { DashboardEditLockAPI } from '@grafana/data';
import { acquireDashboardEditLock } from 'app/features/dashboard-edit-lock/dashboardEditLockState';

export const dashboardEditLockApi: DashboardEditLockAPI = {
  acquire: (options) => acquireDashboardEditLock(options),
};
