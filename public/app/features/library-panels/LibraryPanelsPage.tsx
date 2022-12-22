import React, { useState } from 'react';

import { Page } from 'app/core/components/Page/Page';

import { LibraryPanelsSearch } from './components/LibraryPanelsSearch/LibraryPanelsSearch';
import { OpenLibraryPanelModal } from './components/OpenLibraryPanelModal/OpenLibraryPanelModal';
import { LibraryElementDTO } from './types';

export const LibraryPanelsPage = () => {
  const [selected, setSelected] = useState<LibraryElementDTO | undefined>(undefined);

  return (
    <Page navId="dashboards/library-panels">
      <Page.Contents>
        <LibraryPanelsSearch onClick={setSelected} showSecondaryActions showSort showPanelFilter showFolderFilter />
        {selected ? <OpenLibraryPanelModal onDismiss={() => setSelected(undefined)} libraryPanel={selected} /> : null}
      </Page.Contents>
    </Page>
  );
};

export default LibraryPanelsPage;
