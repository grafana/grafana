import { useState } from 'react';

import { Spinner, Stack } from '@grafana/ui';
import { type OwnerReference } from 'app/api/clients/folder/v1beta1';
import { FormLoadingErrorAlert } from 'app/features/provisioning/components/Dashboards/FormLoadingErrorAlert';
import { NewProvisionedFolderForm } from 'app/features/provisioning/components/Folders/NewProvisionedFolderForm';
import { SaveTargetSwitch } from 'app/features/provisioning/components/Shared/SaveTargetSwitch';
import { RepoViewStatus } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import {
  getSaveTarget,
  type SaveTarget,
  useSaveRepositoryView,
} from 'app/features/provisioning/hooks/useSaveRepositoryView';
import { isItemManagedByRepository } from 'app/features/provisioning/utils/managedResource';
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
  const view = useSaveRepositoryView({
    folderUid: parentFolder?.uid,
    isManaged: isItemManagedByRepository(parentFolder),
  });
  const [chosenTarget, setChosenTarget] = useState<SaveTarget | undefined>(undefined);
  const target = getSaveTarget(view, chosenTarget);

  // Rendering a form before the lookup settles would swap it out from under anything already typed
  if (view.status === RepoViewStatus.Loading) {
    return <Spinner />;
  }

  return (
    <Stack direction="column" gap={2}>
      {target === 'repository' ? (
        <NewProvisionedFolderForm view={view} onDismiss={onDismiss} />
      ) : (
        <>
          {/* The database form below is a fallback, not a decision, so say why the repository is missing */}
          {view.status === RepoViewStatus.Error && <FormLoadingErrorAlert error={view.error} />}
          <NewFolderForm parentFolder={parentFolder} onConfirm={onCreateDatabaseFolder} onCancel={onDismiss} />
        </>
      )}
      {/* Outside the form, so a read-only or dead-ended repository still leaves a way to the database */}
      {view.canChooseTarget && <SaveTargetSwitch resource="folder" target={target} onChange={setChosenTarget} />}
    </Stack>
  );
}
