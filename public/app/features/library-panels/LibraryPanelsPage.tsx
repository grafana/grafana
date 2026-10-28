import { useState } from 'react';

import { Page } from 'app/core/components/Page/Page';
import { NavID } from 'app/core/navtree/constants';
import { useDashboardsPageNav } from 'app/features/browse-dashboards/hooks/useDashboardsPageNav';

import { LibraryPanelsSearch } from './components/LibraryPanelsSearch/LibraryPanelsSearch';
import { OpenLibraryPanelModal } from './components/OpenLibraryPanelModal/OpenLibraryPanelModal';
import { type LibraryElementDTO } from './types';

export const LibraryPanelsPage = () => {
  const [selected, setSelected] = useState<LibraryElementDTO | undefined>(undefined);
  const pageNav = useDashboardsPageNav(NavID.dashboardsLibraryPanels);

  return (
    <Page navId="dashboards/library-panels" pageNav={pageNav}>
      <Page.Contents>
        <LibraryPanelsSearch onClick={setSelected} showSecondaryActions showSort showPanelFilter showFolderFilter />
        {selected ? <OpenLibraryPanelModal onDismiss={() => setSelected(undefined)} libraryPanel={selected} /> : null}
      </Page.Contents>
    </Page>
  );
};

export default LibraryPanelsPage;
