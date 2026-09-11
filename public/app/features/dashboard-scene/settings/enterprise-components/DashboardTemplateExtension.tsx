import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Resource, type ResourceList } from 'app/features/apiserver/types';
import { type DecoratedRevisionModel } from 'app/features/dashboard/types/revisionModels';

import { type DashboardScene } from '../../scene/DashboardScene';

// Structural subset of the enterprise DashboardTemplateSpec.
export interface DashboardTemplateResourceSpec {
  title: string;
  description: string;
  tags: string[];
  dashboardVersion: string;
  dashboard: DashboardV2Spec;
}

export interface DashboardTemplateExtensionHooks {
  loadTemplate(uid: string): Promise<Resource<DashboardTemplateResourceSpec>>;

  listHistory(uid: string, options: { limit: number; continueToken?: string }): Promise<ResourceList<unknown>>;

  // Builds a PUT body that keeps the current outer template spec fields and replaces
  // only spec.dashboard with the selected historical version's embedded dashboard,
  // then updates the scene to reflect the new current state.
  restore(scene: DashboardScene, version: DecoratedRevisionModel): Promise<boolean>;
}

// Default no-op implementation. Org templates is an enterprise-only feature — the
// real implementations are registered by the enterprise bundle at startup. If a pure
// OSS build somehow reaches these code paths (e.g. via the feature toggle being on
// without the enterprise bundle linked), loadTemplate throws and history/restore
// degrade to empty/false rather than crash.
let internal: DashboardTemplateExtensionHooks = {
  loadTemplate: async () => {
    throw new Error('Org template loading is only available in Grafana Enterprise');
  },
  listHistory: async () => ({ kind: '', apiVersion: '', metadata: { resourceVersion: '0' }, items: [] }),
  restore: async () => false,
};

export function registerDashboardTemplateExtension(hooks: DashboardTemplateExtensionHooks) {
  internal = hooks;
}

export function getDashboardTemplateExtension(): DashboardTemplateExtensionHooks {
  return internal;
}
