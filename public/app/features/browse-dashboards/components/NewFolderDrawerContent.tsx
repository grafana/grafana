import { useState } from 'react';

import { Spinner, Stack } from '@grafana/ui';
import { type OwnerReference } from 'app/api/clients/folder/v1beta1';
import { FormLoadingErrorAlert } from 'app/features/provisioning/components/Dashboards/FormLoadingErrorAlert';
import { type SaveTarget, SaveTargetSwitch } from 'app/features/provisioning/components/Dashboards/SaveTargetSwitch';
import { NewProvisionedFolderForm } from 'app/features/provisioning/components/Folders/NewProvisionedFolderForm';
import {
  RepoViewStatus,
  useGetResourceRepositoryView,
} from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { useProvisionedFolderFormData } from 'app/features/provisioning/hooks/useProvisionedFolderFormData';
import { isItemManagedByRepository } from 'app/features/provisioning/utils/managedResource';
import { isRootFolderUID } from 'app/features/search/constants';
import { type FolderDTO } from 'app/types/folders';

import { NewFolderForm } from './NewFolderForm';

interface Props {
  parentFolder?: FolderDTO;
  onDismiss: () => void;
  onCreateDatabaseFolder: (folderName: string, teamOwnerRefs?: OwnerReference[]) => void;
}

// Shows the Git or database form for a new folder.
// Kept out of CreateNewButton so the choice resets every time the drawer opens.
export function NewFolderDrawerContent({ parentFolder, onDismiss, onCreateDatabaseFolder }: Props) {
  // `uid` is undefined, empty or `general` at the dashboards root
  const isRoot = isRootFolderUID(parentFolder?.uid);
  const view = useGetResourceRepositoryView({
    folderName: isRoot ? undefined : parentFolder?.uid,
    // A folderless repo can only own folders created at the root.
    // Instance repos are returned without a flag, so includeInstance is not needed.
    includeFolderless: isRoot,
  });
  const data = useProvisionedFolderFormData({
    view,
    title: '', // Empty title for new folders
  });
  const [chosenTarget, setChosenTarget] = useState<SaveTarget | undefined>(undefined);

  // The parent's own annotation settles a managed subfolder without waiting on the lookup, so a
  // slow or failed lookup can never route a repository-managed folder to the database form
  const isProvisioned = isItemManagedByRepository(parentFolder) || Boolean(data.repository);
  const canChooseTarget = isRoot && data.repository?.target === 'folderless';
  const target: SaveTarget = canChooseTarget && chosenTarget ? chosenTarget : isProvisioned ? 'repository' : 'database';

  // Rendering a form before the lookup settles would swap it out from under anything already typed
  if (!isProvisioned && data.isLoading) {
    return <Spinner />;
  }

  return (
    <Stack direction="column" gap={2}>
      {target === 'repository' ? (
        <NewProvisionedFolderForm data={data} onDismiss={onDismiss} />
      ) : (
        <>
          {/* The database form below is a fallback, not a decision, so say why the repository is missing */}
          {data.status === RepoViewStatus.Error && <FormLoadingErrorAlert error={data.error} />}
          <NewFolderForm parentFolder={parentFolder} onConfirm={onCreateDatabaseFolder} onCancel={onDismiss} />
        </>
      )}
      {/* Outside the form, so a read-only or dead-ended repository still leaves a way to the database */}
      {canChooseTarget && <SaveTargetSwitch resource="folder" target={target} onChange={setChosenTarget} />}
    </Stack>
  );
}
