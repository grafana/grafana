import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';

import { type ItemManager } from '../hooks/useManagerLookup';

export function ManagerBadge({ manager }: { manager: ItemManager }) {
  if (!manager.isManaged) {
    return null;
  }
  // Without repositoryName the badge stays a plain icon, which fits a dense list better than its dropdown.
  return (
    <ManagedBadge
      managerKind={manager.kind}
      name={manager.repository?.title || manager.id}
      isOrphaned={manager.isOrphaned}
    />
  );
}
