import { type SupportedResource } from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { isIconName } from '@grafana/data';
import { type IconName } from '@grafana/ui';

/** A provisioning kind described by its app manifest, from the settings endpoint's `availableResources`. */
export interface ManifestKind {
  group: string;
  kind: string;
  resource: string;
  label: string;
  pluralLabel: string;
  icon: IconName;
}

let manifestKinds: ManifestKind[] = [];

/** Replaces the manifest kinds with the active `availableResources` that an app manifest declares. */
export function setManifestKinds(availableResources: SupportedResource[] = []) {
  manifestKinds = availableResources.flatMap((r) => {
    if (!r.resource || r.disabled) {
      return [];
    }
    const label = r.label || r.kind;
    return [
      {
        group: r.group,
        kind: r.kind,
        resource: r.resource,
        label,
        pluralLabel: r.pluralLabel || label,
        icon: isIconName(r.icon) ? r.icon : 'file-alt',
      },
    ];
  });
}

export function getManifestKinds(): ManifestKind[] {
  return manifestKinds;
}
