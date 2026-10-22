import { ScopedResourceClient } from 'app/features/apiserver/client';
import { type Resource, type ResourceForCreate } from 'app/features/apiserver/types';

import {
  SAVED_DASHBOARD_VIEW_GROUP,
  type SAVED_DASHBOARD_VIEW_KIND,
  SAVED_DASHBOARD_VIEW_RESOURCE,
  SAVED_DASHBOARD_VIEW_VERSION,
  type SavedDashboardViewSpec,
} from './types';

export type SavedDashboardView = Resource<SavedDashboardViewSpec, object, typeof SAVED_DASHBOARD_VIEW_KIND>;

function client() {
  return new ScopedResourceClient<SavedDashboardViewSpec, object, typeof SAVED_DASHBOARD_VIEW_KIND>({
    group: SAVED_DASHBOARD_VIEW_GROUP,
    version: SAVED_DASHBOARD_VIEW_VERSION,
    resource: SAVED_DASHBOARD_VIEW_RESOURCE,
  });
}

export const savedDashboardViewsApi = {
  /**
   * Views belonging to one dashboard. The backend's FilterList re-checks every item against the
   * caller's dashboard permissions regardless of this selector (see the backend spec, 4.3) — it's
   * what makes this "the views for this dashboard", not a security boundary by itself.
   */
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
