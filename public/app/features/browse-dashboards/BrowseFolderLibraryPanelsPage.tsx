import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { Page } from 'app/core/components/Page/Page';

import { useGetFolderQueryFacade } from '../../api/clients/folder/v1beta1/hooks';
import { GrafanaRouteComponentProps } from '../../core/navigation/types';
import { FolderActionsButton } from '../browse-dashboards/components/FolderActionsButton';
import { buildNavModel, getLibraryPanelsTabID } from '../folders/state/navModel';
import { LibraryPanelsSearch } from '../library-panels/components/LibraryPanelsSearch/LibraryPanelsSearch';
import { OpenLibraryPanelModal } from '../library-panels/components/OpenLibraryPanelModal/OpenLibraryPanelModal';
import { LibraryElementDTO } from '../library-panels/types';

import { useSaveFolderMutation } from './api/browseDashboardsAPI';

export interface OwnProps extends GrafanaRouteComponentProps<{ uid: string }> {}

export function BrowseFolderLibraryPanelsPage() {
  const { uid: folderUID = '' } = useParams();
  const { data: folderDTO } = useGetFolderQueryFacade(folderUID);
  const [selected, setSelected] = useState<LibraryElementDTO | undefined>(undefined);
  const [saveFolder] = useSaveFolderMutation();

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
