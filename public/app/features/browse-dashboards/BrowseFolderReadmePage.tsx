import { useMemo } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { useGetFolderQueryFacade, useUpdateFolder } from 'app/api/clients/folder/v1beta1/hooks';
import { Page } from 'app/core/components/Page/Page';

import { GrafanaRouteComponentProps } from '../../core/navigation/types';
import { ManagerKind } from '../apiserver/types';
import { FolderActionsButton } from '../browse-dashboards/components/FolderActionsButton';
import { buildNavModel, getReadmeTabID } from '../folders/state/navModel';
import { FolderReadmeContent } from '../provisioning/components/Folders/FolderReadmeContent';
import { useGetResourceRepositoryView } from '../provisioning/hooks/useGetResourceRepositoryView';

export interface OwnProps extends GrafanaRouteComponentProps<{ uid: string }> {}

export function BrowseFolderReadmePage() {
  const { uid: folderUID = '' } = useParams();
  const { data: folderDTO } = useGetFolderQueryFacade(folderUID);
  const [saveFolder] = useUpdateFolder();
  const { repoType, isReadOnlyRepo } = useGetResourceRepositoryView({ folderName: folderUID });

  const navModel = useMemo(() => {
    if (!folderDTO) {
      return undefined;
    }
    const model = buildNavModel(folderDTO);

    // Set the "README" tab to active
    const readmeTabID = getReadmeTabID(folderDTO.uid);
    const readmeTab = model.children?.find((child) => child.id === readmeTabID);
    if (readmeTab) {
      readmeTab.active = true;
    }
    return model;
  }, [folderDTO]);

  const isProvisionedFolder = folderDTO?.managedBy === ManagerKind.Repo;

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
      actions={<>{folderDTO && <FolderActionsButton folder={folderDTO} repoType={repoType} isReadOnlyRepo={isReadOnlyRepo} />}</>}
    >
      <Page.Contents>
        <FolderReadmeContent folderUID={folderUID} />
      </Page.Contents>
    </Page>
  );
}

export default BrowseFolderReadmePage;
