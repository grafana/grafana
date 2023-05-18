import React, { useMemo, useState } from 'react';

import { Page } from 'app/core/components/Page/Page';

import { GrafanaRouteComponentProps } from '../../core/navigation/types';
import { FolderActionsButton } from '../browse-dashboards/components/FolderActionsButton';
import { buildNavModel, getLibraryPanelsTabID } from '../folders/state/navModel';
import { LibraryPanelsSearch } from '../library-panels/components/LibraryPanelsSearch/LibraryPanelsSearch';
import { OpenLibraryPanelModal } from '../library-panels/components/OpenLibraryPanelModal/OpenLibraryPanelModal';
import { LibraryElementDTO } from '../library-panels/types';

import { useGetFolderQuery } from './api/browseDashboardsAPI';

export interface OwnProps extends GrafanaRouteComponentProps<{ uid: string }> {}

export function BrowseFolderLibraryPanelsPage({ match }: OwnProps) {
  const { uid: folderUID } = match.params;
  const { data: folderDTO, isLoading } = useGetFolderQuery(folderUID);
  const [selected, setSelected] = useState<LibraryElementDTO | undefined>(undefined);

  const navModel = useMemo(() => {
    if (!folderDTO) {
      return undefined;
    }
    const model = buildNavModel(folderDTO);

    // Set the "Library panels" tab to active
    const libraryPanelsTabID = getLibraryPanelsTabID(folderDTO.uid);
    const libraryPanelsTab = model.children?.find((child) => child.id === libraryPanelsTabID);
    if (libraryPanelsTab) {
      libraryPanelsTab.active = true;
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
        <LibraryPanelsSearch
          onClick={setSelected}
          currentFolderUID={folderUID}
          showSecondaryActions
          showSort
          showPanelFilter
        />
        {selected ? <OpenLibraryPanelModal onDismiss={() => setSelected(undefined)} libraryPanel={selected} /> : null}
      </Page.Contents>
    </Page>
  );
}

export default BrowseFolderLibraryPanelsPage;
