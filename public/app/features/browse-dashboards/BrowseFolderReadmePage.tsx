import { useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { reportInteraction } from '@grafana/runtime';
import { Stack, Text } from '@grafana/ui';
import { useGetFolderQueryFacade, useUpdateFolder } from 'app/api/clients/folder/v1beta1/hooks';
import { FolderRepo } from 'app/core/components/NestedFolderPicker/FolderRepo';
import { Page } from 'app/core/components/Page/Page';

import { type GrafanaRouteComponentProps } from '../../core/navigation/types';
import { ManagerKind } from '../apiserver/types';
import { buildNavModel, getReadmeTabID } from '../folders/state/navModel';
import { FolderReadmeContent } from '../provisioning/components/Folders/FolderReadme';
import { useGetResourceRepositoryView } from '../provisioning/hooks/useGetResourceRepositoryView';

import { FolderActionsButton } from './components/FolderActionsButton';

export interface OwnProps extends GrafanaRouteComponentProps<{ uid: string }> {}

export function BrowseFolderReadmePage() {
  const { uid: folderUID = '' } = useParams();
  const { data: folderDTO } = useGetFolderQueryFacade(folderUID);
  const [saveFolder] = useUpdateFolder();
  const { repoType, isReadOnlyRepo } = useGetResourceRepositoryView({ folderName: folderUID });

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
    const model = buildNavModel(folderDTO);

    const readmeTabID = getReadmeTabID(folderDTO.uid);
    const readmeTab = model.children?.find((child) => child.id === readmeTabID);
    if (readmeTab) {
      readmeTab.active = true;
    }
    return model;
  }, [folderDTO]);

  const isProvisionedFolder = folderDTO?.managedBy === ManagerKind.Repo;

  const renderTitle = folderDTO
    ? (title: string) => (
        <Stack alignItems="center" gap={2}>
          <Text element="h1">{title}</Text>
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
      onEditTitle={onEditTitle}
      renderTitle={renderTitle}
      actions={
        folderDTO && <FolderActionsButton folder={folderDTO} repoType={repoType} isReadOnlyRepo={isReadOnlyRepo} />
      }
    >
      <Page.Contents>
        <FolderReadmeContent folderUID={folderUID} />
      </Page.Contents>
    </Page>
  );
}

export default BrowseFolderReadmePage;
