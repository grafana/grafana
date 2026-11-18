import { type LibraryPanel } from '@grafana/schema';
import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';
import {
  getManagerIdentity,
  getManagerKind,
  getSourcePath,
  isManaged,
} from 'app/features/provisioning/utils/managedResource';

export function LibraryPanelManagedBadge({ panel }: { panel: Pick<LibraryPanel, 'metadata'> }) {
  if (!isManaged(panel)) {
    return null;
  }
  return (
    <ManagedBadge
      managerKind={getManagerKind(panel)}
      name={getManagerIdentity(panel)}
      repositoryName={getManagerIdentity(panel)}
      sourcePath={getSourcePath(panel)}
    />
  );
}
