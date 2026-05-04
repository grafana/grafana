import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Resource } from 'app/features/apiserver/types';
import { type DecoratedRevisionModel } from 'app/features/dashboard/types/revisionModels';

import { type DashboardScene } from '../../scene/DashboardScene';

// Structural subset of the enterprise OrgDashboardTemplateSpec. Defined locally so OSS
// call sites can type the load response without importing from public/app/extensions/.
// The enterprise OrgDashboardTemplate is structurally compatible with this shape.
export interface OrgTemplateResourceSpec {
  title: string;
  description?: string;
  tags: string[];
  thumbnail_url?: string;
  source_dashboard_uid?: string;
  dashboard: DashboardV2Spec;
}

export interface OrgTemplateHistoryListResult {
  // Raw k8s list items. Consumers transform these through the same
  // VersionsEditView.transformToRevisionModels pipeline used for dashboards.
  items: Array<Resource<unknown>>;
  continueToken?: string;
}

export interface OrgTemplateExtensionHooks {
  loadTemplate(orgTemplateUid: string): Promise<Resource<OrgTemplateResourceSpec>>;

  listHistory(
    orgTemplateUid: string,
    options: { limit: number; continueToken?: string }
  ): Promise<OrgTemplateHistoryListResult>;

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
let internal: OrgTemplateExtensionHooks = {
  loadTemplate: async () => {
    throw new Error('Org template loading is only available in Grafana Enterprise');
  },
  listHistory: async () => ({ items: [], continueToken: undefined }),
  restore: async () => false,
};

export function registerOrgTemplateExtension(hooks: OrgTemplateExtensionHooks) {
  internal = hooks;
}

export function getOrgTemplateExtension(): OrgTemplateExtensionHooks {
  return internal;
}
