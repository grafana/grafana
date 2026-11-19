import { type LibraryPanel } from '@grafana/schema';
import { legacyModelToSpecAndStatus } from 'app/api/clients/dashboard/v0alpha1/libraryPanels';
import { SaveProvisionedResourceDrawer } from 'app/features/provisioning/components/Shared/SaveProvisionedResourceDrawer';

const LIBRARY_PANELS_URL = '/library-panels';

type Props = {
  panel: Pick<LibraryPanel, 'uid' | 'name' | 'model' | 'metadata'>;
  onDismiss: () => void;
  /** Replaces the redirect to the library panels page after a commit to the configured branch. */
  onWriteSuccess?: () => void;
  /** Runs before the redirect to the pull-request banner when the change is pushed to a branch. */
  onBranchSaved?: () => void;
} & ({ action: 'create'; repositoryName: string } | { action: 'update' | 'delete'; repositoryName?: never });

/** Commits a library panel to its repository through the shared provisioning drawer. */
export function SaveProvisionedLibraryPanelDrawer({ panel, ...props }: Props) {
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
      // The pull-request banner is shown on the library panels page.
      redirectUrl={LIBRARY_PANELS_URL}
    />
  );
}
