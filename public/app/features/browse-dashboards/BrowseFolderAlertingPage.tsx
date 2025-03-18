import { useMemo } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { Page } from 'app/core/components/Page/Page';
import { buildNavModel, getAlertingTabID } from 'app/features/folders/state/navModel';
import { useSelector } from 'app/types';

import { AlertsFolderView } from '../alerting/unified/AlertsFolderView';

import { useGetFolderQuery, useSaveFolderMutation } from './api/browseDashboardsAPI';
import { FolderActionsButton } from './components/FolderActionsButton';

export function BrowseFolderAlertingPage() {
  const { uid: folderUID = '' } = useParams();
  const { data: folderDTO } = useGetFolderQuery(folderUID);
  const folder = useSelector((state) => state.folder);
  const [saveFolder] = useSaveFolderMutation();

  const navModel = useMemo(() => {
    if (!folderDTO) {
      return undefined;
    }
    const model = buildNavModel(folderDTO);

    // Set the "Alerting" tab to active
    const alertingTabID = getAlertingTabID(folderDTO.uid);
    const alertingTab = model.children?.find((child) => child.id === alertingTabID);
    if (alertingTab) {
      alertingTab.active = true;
    }
    return model;
  }, [folderDTO]);

  const onEditTitle = folderUID
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
      actions={<>{folderDTO && <FolderActionsButton folder={folderDTO} />}</>}
    >
      <Page.Contents>
        <AlertsFolderView folder={folder} />
      </Page.Contents>
    </Page>
  );
}

export default BrowseFolderAlertingPage;
