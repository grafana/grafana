import React, { useState } from 'react';
import { Page } from 'app/core/components/Page/Page';
import { LibraryPanelsSearch } from './components/LibraryPanelsSearch/LibraryPanelsSearch';
import { OpenLibraryPanelModal } from './components/OpenLibraryPanelModal/OpenLibraryPanelModal';
export const LibraryPanelsPage = () => {
    const [selected, setSelected] = useState(undefined);
    return (React.createElement(Page, { navId: "dashboards/library-panels" },
        React.createElement(Page.Contents, null,
            React.createElement(LibraryPanelsSearch, { onClick: setSelected, showSecondaryActions: true, showSort: true, showPanelFilter: true, showFolderFilter: true }),
            selected ? React.createElement(OpenLibraryPanelModal, { onDismiss: () => setSelected(undefined), libraryPanel: selected }) : null)));
};
export default LibraryPanelsPage;
//# sourceMappingURL=LibraryPanelsPage.js.map