import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { NavID, NavWeight } from '../constants';
import { isSignedIn, type NavEntryBuilder } from '../utils';

// Notebooks reuse dashboard RBAC: an unscoped dashboards:read grants the list
// page, and the apiserver filters the list down to what the user may see.
export const notebooksNavEntry: NavEntryBuilder = {
  when: () =>
    isSignedIn() &&
    contextSrv.hasPermission(AccessControlAction.DashboardsRead) &&
    getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardNotebooks, false),
  build: () => ({
    text: 'Notebooks',
    id: NavID.notebooks,
    subTitle: 'Investigation notebooks created from workspaces, dashboards, alerts, and incidents.',
    icon: 'book',
    sortWeight: NavWeight.notebooks,
    url: '/notebooks',
  }),
};
