import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Drawer, IconButton, Stack, Text } from '@grafana/ui';
import { useGetFolderQueryFacade, useUpdateFolder } from 'app/api/clients/folder/v1beta1/hooks';
import { FolderRepo } from 'app/core/components/NestedFolderPicker/FolderRepo';
import { Page } from 'app/core/components/Page/Page';

import { type GrafanaRouteComponentProps } from '../../core/navigation/types';
import { ManagerKind } from '../apiserver/types';
import { buildNavModel, getReadmeTabID } from '../folders/state/navModel';
import { FolderReadmeContent } from '../provisioning/components/Folders/FolderReadme';
import { RenameProvisionedFolderForm } from '../provisioning/components/Folders/RenameProvisionedFolderForm';
import { useGetResourceRepositoryView } from '../provisioning/hooks/useGetResourceRepositoryView';

import { FolderActionsButton } from './components/FolderActionsButton';
import { getFolderPermissions } from './permissions';

export interface OwnProps extends GrafanaRouteComponentProps<{ uid: string }> {}

export function BrowseFolderReadmePage() {
  const { uid: folderUID = '' } = useParams();
  const { data: folderDTO } = useGetFolderQueryFacade(folderUID);
  const [saveFolder] = useUpdateFolder();
  const { repoType, isReadOnlyRepo, repository } = useGetResourceRepositoryView({ folderName: folderUID });
  const [showRenameDrawer, setShowRenameDrawer] = useState(false);

  // Fire one tab-view event per folder once the repository type is known.
  const reportedFolderUID = useRef<string | null>(null);
  useEffect(() => {
    if (!folderUID || reportedFolderUID.current === folderUID) {
      return;
    }
    reportedFolderUID.current = folderUID;
    reportInteraction('grafana_provisioning_readme_tab_viewed', {
      repositoryType: repoType ?? 'unknown',
    });
  }, [folderUID, repoType]);

  const navModel = useMemo(() => {
    if (!folderDTO) {
      return undefined;
    }
    const model = buildNavModel(folderDTO, undefined, { isProvisionedFolder: !!repository });

    const readmeTabID = getReadmeTabID(folderDTO.uid);
    const readmeTab = model.children?.find((child) => child.id === readmeTabID);
    if (readmeTab) {
      readmeTab.active = true;
    }
    return model;
  }, [folderDTO, repository]);

  const isProvisionedFolder = folderDTO?.managedBy === ManagerKind.Repo;
  const isRepoRootFolder = isProvisionedFolder && folderUID === repository?.name;
  const { canEditFolders } = getFolderPermissions(folderDTO);
  const showEditTitle = canEditFolders && !!folderUID;

  const renderTitle = folderDTO
    ? (title: string) => (
        <Stack alignItems="center" gap={2}>
          <Text element="h1">{title}</Text>
          {showEditTitle && isProvisionedFolder && !isRepoRootFolder && !isReadOnlyRepo && (
            <IconButton
              name="pen"
              size="lg"
              tooltip={t('browse-dashboards.action.rename-provisioned-folder', 'Rename provisioned folder')}
              onClick={() => setShowRenameDrawer(true)}
            />
          )}
          <FolderRepo folder={folderDTO} />
        </Stack>
      )
    : undefined;

  const onEditTitle =
    folderUID && !isProvisionedFolder
      ? async (newValue: string) => {
          if (folderDTO) {
            const result = await saveFolder({
              ...folderDTO,
              title: newValue,
            });
            if ('error' in result) {
              throw result.error;
            }
          }
        }
      : undefined;

  return (
    <Page
      navId="dashboards/browse"
      pageNav={navModel}
      onEditTitle={showEditTitle && !isProvisionedFolder ? onEditTitle : undefined}
      renderTitle={renderTitle}
      actions={
        folderDTO && <FolderActionsButton folder={folderDTO} repoType={repoType} isReadOnlyRepo={isReadOnlyRepo} />
      }
    >
      <Page.Contents>
        <FolderReadmeContent folderUID={folderUID} />
      </Page.Contents>
      {showRenameDrawer && folderDTO && (
        <Drawer
          title={
            <Text variant="h3" element="h2">
              {t('browse-dashboards.action.rename-provisioned-folder', 'Rename provisioned folder')}
            </Text>
          }
          subtitle={folderDTO.title}
          onClose={() => setShowRenameDrawer(false)}
        >
          <RenameProvisionedFolderForm folder={folderDTO} onDismiss={() => setShowRenameDrawer(false)} />
        </Drawer>
      )}
    </Page>
  );
}

export default BrowseFolderReadmePage;
