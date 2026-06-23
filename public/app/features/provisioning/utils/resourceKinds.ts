import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { t } from '@grafana/i18n';
import { type IconName } from '@grafana/ui';
import { type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';
import { getIconForKind } from 'app/features/search/service/utils';

import { type ItemType } from '../types';

/**
 * Per-kind UI metadata for provisioning resources.
 *
 * This is the single source of truth the UI reads from instead of scattering
 * per-kind knowledge across switch statements (item types, icons, count labels,
 * resource-ref unions). Adding a new provisioning kind should be one entry here
 * plus, if needed, enabling it on the backend so it appears in the settings
 * endpoint's `availableResources`.
 */
export interface ResourceKindInfo {
  /** API group, e.g. `dashboard.grafana.app`. */
  group: string;
  /** Kubernetes Kind, e.g. `Dashboard`. */
  kind: string;
  /** Plural resource name as reported by the API (`ResourceListItem.resource`), e.g. `dashboards`. */
  resource: string;
  /** Label shown for this kind in the combined files/resources tree. */
  itemType: ItemType;
  /** Icon shown for this kind in the resource tree. Sourced from the search package's getIconForKind. */
  icon: IconName;
  /** Builds the in-app route to view a single resource of this kind, given its k8s name. */
  getRoute?: (name: string) => string;
  /** Localized "N <kind>" count label (handles singular/plural). */
  countLabel: (count: number) => string;
}

// countLabel uses literal `t()` keys per kind so i18n extraction keeps working —
// see useResourceStats for where these counts are surfaced.

/**
 * Registry of provisioning resource kinds, keyed by a stable identifier.
 *
 * `satisfies` checks each entry against ResourceKindInfo without widening the
 * value type, so callers still get the concrete record back.
 */
export const resourceKindInfos = {
  folder: {
    group: FOLDER_API_GROUP,
    kind: 'Folder',
    resource: 'folders',
    itemType: 'Folder',
    icon: getIconForKind('folder'),
    getRoute: (name: string) => `/dashboards/f/${name}`,
    countLabel: (count: number) =>
      t('provisioning.bootstrap-step.folders-count', '', {
        count,
        defaultValue_one: '{{count}} folder',
        defaultValue_other: '{{count}} folders',
      }),
  },
  dashboard: {
    group: DASHBOARD_API_GROUP,
    kind: 'Dashboard',
    resource: 'dashboards',
    itemType: 'Dashboard',
    icon: getIconForKind('dashboard'),
    getRoute: (name: string) => `/d/${name}`,
    countLabel: (count: number) =>
      t('provisioning.bootstrap-step.dashboards-count', '', {
        count,
        defaultValue_one: '{{count}} dashboard',
        defaultValue_other: '{{count}} dashboards',
      }),
  },
} satisfies Record<string, ResourceKindInfo>;

const allKindInfos: ResourceKindInfo[] = Object.values(resourceKindInfos);

/** Look up a kind by its plural resource name (`ResourceListItem.resource`). */
export function getKindInfoByResource(resource?: string): ResourceKindInfo | undefined {
  return allKindInfos.find((info) => info.resource === resource);
}

/** Look up a kind by its tree item type. */
export function getKindInfoByItemType(itemType: ItemType): ResourceKindInfo | undefined {
  return allKindInfos.find((info) => info.itemType === itemType);
}

/**
 * Look up a kind by a resource-stat group, accepting both the full API group
 * (`folder.grafana.app`) and the legacy short plural (`folders`) that the stats
 * endpoint can return interchangeably.
 */
export function getKindInfoByStatGroup(group?: string): ResourceKindInfo | undefined {
  return allKindInfos.find((info) => info.group === group || info.resource === group);
}

/**
 * Resolves which kinds the backend currently exposes for provisioning, gating on
 * the config-derived `availableResources` from the settings endpoint. Disabled
 * kinds (declared but not acted on) are excluded.
 *
 * When `availableResources` is unset (e.g. settings not loaded yet) we fall back
 * to the full registry so the UI keeps working for the always-on kinds.
 */
export function getAvailableResourceKinds(availableResources?: SupportedResource[]): ResourceKindInfo[] {
  if (!availableResources) {
    return allKindInfos;
  }
  return allKindInfos.filter((info) =>
    availableResources.some((r) => r.group === info.group && r.kind === info.kind && !r.disabled)
  );
}

/** Whether a given kind is currently enabled for provisioning per the settings endpoint. */
export function isResourceKindAvailable(info: ResourceKindInfo, availableResources?: SupportedResource[]): boolean {
  return getAvailableResourceKinds(availableResources).includes(info);
}
