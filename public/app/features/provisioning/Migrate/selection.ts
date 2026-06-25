import { type ResourceRef } from 'app/api/clients/provisioning/v0alpha1';

import { type FolderRow, type MigratableResource, resourceKey } from './hooks/useFolderMigrationData';

/**
 * Summary of what the user has picked in the Resources to migrate table.
 * `items` counts the user's ticks (folders + resources selected on their own)
 * for the button label; `resources` is the resolved set of resource refs the
 * migrate job actually receives.
 */
export interface MigrationSelection {
  /** Folders explicitly ticked. */
  folders: number;
  /** Folders + independently-ticked resources, for the "Migrate selected (N)" label. */
  items: number;
  /** The resource refs to send to the migrate job, each tagged with its kind. */
  resources: ResourceRef[];
}

/**
 * Resolves the table selection into the migrate job payload.
 *
 * Folders aren't accepted by the migrate job directly, and selective migration
 * isn't recursive, so a selected folder cascades only to the resources directly
 * inside it (`directResources`, already filtered to unmanaged ones).
 * Individually-ticked resources are added on top, de-duplicated against the ones
 * a selected folder already covers — so picking a folder *and* a resource inside
 * it counts that resource once. Each resource's ref (group/kind) comes from its
 * own kind, so dashboards, playlists, and any future kind resolve correctly.
 *
 * `selectedResourceUids` holds composite resource keys (see `resourceKey`), not
 * bare names, so resources of different kinds that share a name never collide.
 */
export function resolveSelection(
  folders: FolderRow[],
  selectedFolderUids: Set<string>,
  selectedResourceKeys: Set<string>
): MigrationSelection {
  // Look up a resource by its composite key so individually-ticked rows resolve
  // to the right kind without the caller threading kind through the selection
  // sets.
  const resourceByKey = new Map<string, MigratableResource>();
  for (const folder of folders) {
    for (const resource of folder.directResources) {
      resourceByKey.set(resourceKey(resource), resource);
    }
  }

  const resources: ResourceRef[] = [];
  const seen = new Set<string>();
  const addResource = (key: string) => {
    if (seen.has(key)) {
      return;
    }
    const resource = resourceByKey.get(key);
    if (!resource) {
      return;
    }
    seen.add(key);
    resources.push({ name: resource.uid, group: resource.kind.group, kind: resource.kind.kind });
  };

  // Resources covered by a selected folder are tracked separately so we don't
  // double-count them in the "items" tally below.
  const folderCoveredKeys = new Set<string>();
  for (const folder of folders) {
    if (selectedFolderUids.has(folder.uid)) {
      folder.directResources.forEach((r) => folderCoveredKeys.add(resourceKey(r)));
    }
  }

  folderCoveredKeys.forEach(addResource);
  selectedResourceKeys.forEach(addResource);

  const independentResources = Array.from(selectedResourceKeys).filter((key) => !folderCoveredKeys.has(key)).length;

  return {
    folders: selectedFolderUids.size,
    items: selectedFolderUids.size + independentResources,
    resources,
  };
}
