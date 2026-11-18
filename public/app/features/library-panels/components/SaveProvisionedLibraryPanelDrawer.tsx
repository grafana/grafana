import { type LibraryPanel } from '@grafana/schema';
import { legacyModelToSpecAndStatus } from 'app/api/clients/dashboard/v0alpha1/libraryPanels';
import { SaveProvisionedResourceDrawer } from 'app/features/provisioning/components/Shared/SaveProvisionedResourceDrawer';
import { useProvisionedResourceDrawerHandlers } from 'app/features/provisioning/hooks/useProvisionedResourceDrawerHandlers';
import { resourceKindInfos } from 'app/features/provisioning/utils/resourceKinds';

type Props = {
  panel: Pick<LibraryPanel, 'uid' | 'name' | 'model' | 'metadata'>;
  onDismiss: () => void;
  onWriteSuccess?: () => void;
  /** Runs before the default redirect to the pull-request banner when the change is pushed to a branch. */
  onBranchSaved?: () => void;
} & ({ action: 'create'; repositoryName: string } | { action: 'update' | 'delete'; repositoryName?: never });

/** Commits a library panel to its repository through the shared provisioning drawer. */
export function SaveProvisionedLibraryPanelDrawer({ panel, onBranchSaved, ...props }: Props) {
  const { makeOnBranchSuccess } = useProvisionedResourceDrawerHandlers(resourceKindInfos.librarypanel);
  const resource = {
    apiVersion: 'dashboard.grafana.app/v0alpha1',
    kind: 'LibraryPanel',
    metadata: { ...panel.metadata, name: panel.uid },
    ...legacyModelToSpecAndStatus(panel.name, panel.model),
  };

  return (
    <SaveProvisionedResourceDrawer
      {...props}
      resource={resource}
      // Panel settings without a typed spec field (e.g. transformations) live in status.missing.
      body={{ ...resource, metadata: { name: panel.uid } }}
      title={panel.name}
      onBranchSuccess={
        onBranchSaved &&
        ((data) => {
          onBranchSaved();
          makeOnBranchSuccess(props.action)(data);
        })
      }
    />
  );
}
