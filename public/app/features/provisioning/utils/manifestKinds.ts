import { isIconName } from '@grafana/data';
import { type IconName } from '@grafana/ui';
import {
  type AppManifestKind,
  getAppManifestKindLabel,
  getAppManifestKinds,
} from 'app/features/apiserver/appManifests';

/** How the provisioning pages show a kind that an app manifest declares. */
export interface ManifestKind {
  group: string;
  kind: string;
  resource: string;
  label: string;
  pluralLabel: string;
  icon: IconName;
  getRoute?: (name: string) => string;
}

export function getManifestKinds(): ManifestKind[] {
  return getAppManifestKinds().map(toManifestKind);
}

function toManifestKind(kind: AppManifestKind): ManifestKind {
  const url = kind.url;
  return {
    group: kind.group,
    kind: kind.kind,
    resource: kind.resource,
    label: getAppManifestKindLabel(kind, 1),
    pluralLabel: getAppManifestKindLabel(kind, 2),
    icon: isIconName(kind.icon) ? kind.icon : 'file-alt',
    getRoute: url ? (name: string) => url.replace('{name}', encodeURIComponent(name)) : undefined,
  };
}
