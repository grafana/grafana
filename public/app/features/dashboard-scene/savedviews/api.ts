import { ScopedResourceClient } from 'app/features/apiserver/client';
import { type Resource, type ResourceForCreate } from 'app/features/apiserver/types';

import { type SavedDashboardViewSpec } from './types';

const SAVED_DASHBOARD_VIEW_GROUP = 'dashboardviews.grafana.app';
const SAVED_DASHBOARD_VIEW_VERSION = 'v0alpha1';
const SAVED_DASHBOARD_VIEW_RESOURCE = 'saveddashboardviews';
const SAVED_DASHBOARD_VIEW_KIND = 'SavedDashboardView';

export type SavedDashboardView = Resource<SavedDashboardViewSpec, object, typeof SAVED_DASHBOARD_VIEW_KIND>;

function client() {
  return new ScopedResourceClient<SavedDashboardViewSpec, object, typeof SAVED_DASHBOARD_VIEW_KIND>({
    group: SAVED_DASHBOARD_VIEW_GROUP,
    version: SAVED_DASHBOARD_VIEW_VERSION,
    resource: SAVED_DASHBOARD_VIEW_RESOURCE,
  });
}

export const savedDashboardViewsApi = {
  // The selector scopes results to one dashboard; it isn't the permission check (FilterList is).
  async listForDashboard(dashboardUID: string): Promise<SavedDashboardView[]> {
    const result = await client().list({
      fieldSelector: [{ key: 'spec.dashboardUID', operator: '=', value: dashboardUID }],
    });
    return result.items;
  },

  get(name: string): Promise<SavedDashboardView> {
    return client().get(name);
  },

  create(spec: SavedDashboardViewSpec): Promise<SavedDashboardView> {
    const obj: ResourceForCreate<SavedDashboardViewSpec, typeof SAVED_DASHBOARD_VIEW_KIND> = {
      metadata: {},
      spec,
    };
    return client().create(obj);
  },

  update(existing: SavedDashboardView, spec: SavedDashboardViewSpec): Promise<SavedDashboardView> {
    return client().update({ ...existing, spec });
  },

  remove(name: string): Promise<unknown> {
    return client().delete(name, false);
  },
};
