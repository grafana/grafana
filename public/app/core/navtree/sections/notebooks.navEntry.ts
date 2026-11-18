import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { NavID, NavWeight } from '../constants';
import { buildEntries, isSignedIn, type NavEntryBuilder } from '../utils';

const NOTEBOOKS_CHILDREN: NavEntryBuilder[] = [
  {
    when: () => contextSrv.hasPermission(AccessControlAction.NotebooksCreate),
    build: () => ({
      text: 'New notebook',
      id: 'notebooks/new',
      icon: 'plus',
      url: '/notebooks/new?edit=true',
      hideFromTabs: true,
      isCreateAction: true,
    }),
  },
];

// An unscoped notebooks:read grants the list page, and the apiserver filters the list down to
// what the user may see.
export const notebooksNavEntry: NavEntryBuilder = {
  when: () =>
    isSignedIn() &&
    contextSrv.hasPermission(AccessControlAction.NotebooksRead) &&
    getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardNotebooks, false),
  build: () => ({
    text: 'Notebooks',
    id: NavID.notebooks,
    subTitle: 'Create and manage notebooks to tell a story with your data',
    icon: 'gf-notebook',
    sortWeight: NavWeight.notebooks,
    url: '/notebooks',
    children: buildEntries(NOTEBOOKS_CHILDREN),
  }),
};
