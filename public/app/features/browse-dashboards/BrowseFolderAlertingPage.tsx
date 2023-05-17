import React, { useMemo } from 'react';

import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { buildNavModel, getAlertingTabID } from 'app/features/folders/state/navModel';
import { useSelector } from 'app/types';

import { AlertsFolderView } from '../alerting/unified/AlertsFolderView';

import { useGetFolderQuery } from './api/browseDashboardsAPI';
import { FolderActionsButton } from './components/FolderActionsButton';

export interface OwnProps extends GrafanaRouteComponentProps<{ uid: string }> {}

export function BrowseFolderAlertingPage({ match }: OwnProps) {
  const { uid: folderUID } = match.params;
  const { data: folderDTO, isLoading } = useGetFolderQuery(folderUID);
  const folder = useSelector((state) => state.folder);

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

  return (
    <Page
      navId="dashboards/browse"
      pageNav={navModel}
      actions={<>{folderDTO && <FolderActionsButton folder={folderDTO} />}</>}
    >
      <Page.Contents isLoading={isLoading}>
        <AlertsFolderView folder={folder} />
      </Page.Contents>
    </Page>
  );
}

export default BrowseFolderAlertingPage;
