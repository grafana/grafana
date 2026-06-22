import { t } from '@grafana/i18n';
import { type IconName } from '@grafana/ui';
import { type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';

/**
 * Per-kind UI metadata for provisioning resources.
 *
 * This is the single source of truth the UI reads from instead of scattering
 * per-kind knowledge across switch statements (item types, icons, count labels,
 * resource-ref unions). Adding a new provisioning kind should be one entry here
 * plus, if needed, enabling it on the backend so it appears in the settings
 * endpoint's `availableResources`.
 */
export interface ResourceKindDescriptor {
  /** API group, e.g. `dashboard.grafana.app`. */
  group: string;
  /** Kubernetes Kind, e.g. `Dashboard`. */
  kind: string;
  /** Plural resource name as reported by the API (`ResourceListItem.resource`), e.g. `dashboards`. */
  resource: string;
  /** Label shown for this kind in the combined files/resources tree. */
  itemType: string;
  /** Icon shown for this kind in the resource tree. */
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
 * `satisfies` keeps the literal types (so the derived unions below stay narrow)
 * while still checking each entry against ResourceKindDescriptor.
 */
export const RESOURCE_KINDS = {
  folder: {
    group: 'folder.grafana.app',
    kind: 'Folder',
    resource: 'folders',
    itemType: 'Folder',
    icon: 'folder',
    getRoute: (name: string) => `/dashboards/f/${name}`,
    countLabel: (count: number) =>
      t('provisioning.bootstrap-step.folders-count', '', {
        count,
        defaultValue_one: '{{count}} folder',
        defaultValue_other: '{{count}} folders',
      }),
  },
  dashboard: {
    group: 'dashboard.grafana.app',
    kind: 'Dashboard',
    resource: 'dashboards',
    itemType: 'Dashboard',
    icon: 'apps',
    getRoute: (name: string) => `/d/${name}`,
    countLabel: (count: number) =>
      t('provisioning.bootstrap-step.dashboards-count', '', {
        count,
        defaultValue_one: '{{count}} dashboard',
        defaultValue_other: '{{count}} dashboards',
      }),
  },
} satisfies Record<string, ResourceKindDescriptor>;

type ResourceKind = (typeof RESOURCE_KINDS)[keyof typeof RESOURCE_KINDS];

/** Item types backed by a real resource kind (i.e. everything except plain `File`). */
export type ResourceItemType = ResourceKind['itemType'];
/** Known provisioning resource groups. */
export type ResourceGroup = ResourceKind['group'];
/** Known provisioning resource kinds. */
export type ResourceKindName = ResourceKind['kind'];

const ALL_KINDS: ResourceKindDescriptor[] = Object.values(RESOURCE_KINDS);

/** Look up a descriptor by its plural resource name (`ResourceListItem.resource`). */
export function getDescriptorByResource(resource?: string): ResourceKindDescriptor | undefined {
  return ALL_KINDS.find((d) => d.resource === resource);
}

/** Look up a descriptor by its tree item type. */
export function getDescriptorByItemType(itemType: string): ResourceKindDescriptor | undefined {
  return ALL_KINDS.find((d) => d.itemType === itemType);
}

/**
 * Look up a descriptor by a resource-stat group, accepting both the full API
 * group (`folder.grafana.app`) and the legacy short plural (`folders`) that the
 * stats endpoint can return interchangeably.
 */
export function getDescriptorByStatGroup(group?: string): ResourceKindDescriptor | undefined {
  return ALL_KINDS.find((d) => d.group === group || d.resource === group);
}

/**
 * Resolves which kinds the backend currently exposes for provisioning, gating on
 * the config-derived `availableResources` from the settings endpoint. Disabled
 * kinds (declared but not acted on) are excluded.
 *
 * When `availableResources` is unset (e.g. settings not loaded yet) we fall back
 * to the full registry so the UI keeps working for the always-on kinds.
 */
export function getAvailableResourceKinds(availableResources?: SupportedResource[]): ResourceKindDescriptor[] {
  if (!availableResources) {
    return ALL_KINDS;
  }
  return ALL_KINDS.filter((descriptor) =>
    availableResources.some((r) => r.group === descriptor.group && r.kind === descriptor.kind && !r.disabled)
  );
}

/** Whether a given kind is currently enabled for provisioning per the settings endpoint. */
export function isResourceKindAvailable(
  descriptor: ResourceKindDescriptor,
  availableResources?: SupportedResource[]
): boolean {
  return getAvailableResourceKinds(availableResources).includes(descriptor);
}
