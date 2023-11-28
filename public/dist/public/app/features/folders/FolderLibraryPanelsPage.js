import { __awaiter } from "tslib";
import React, { useState } from 'react';
import { connect } from 'react-redux';
import { useAsync } from 'react-use';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from '../../core/selectors/navModel';
import { LibraryPanelsSearch } from '../library-panels/components/LibraryPanelsSearch/LibraryPanelsSearch';
import { OpenLibraryPanelModal } from '../library-panels/components/OpenLibraryPanelModal/OpenLibraryPanelModal';
import { getFolderByUid } from './state/actions';
import { getLoadingNav } from './state/navModel';
const mapStateToProps = (state, props) => {
    const uid = props.match.params.uid;
    return {
        pageNav: getNavModel(state.navIndex, `folder-library-panels-${uid}`, getLoadingNav(1)),
        folderUid: uid,
    };
};
const mapDispatchToProps = {
    getFolderByUid,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export function FolderLibraryPanelsPage({ pageNav, getFolderByUid, folderUid }) {
    const { loading } = useAsync(() => __awaiter(this, void 0, void 0, function* () { return yield getFolderByUid(folderUid); }), [getFolderByUid, folderUid]);
    const [selected, setSelected] = useState(undefined);
    return (React.createElement(Page, { navId: "dashboards/browse", pageNav: pageNav.main },
        React.createElement(Page.Contents, { isLoading: loading },
            React.createElement(LibraryPanelsSearch, { onClick: setSelected, currentFolderUID: folderUid, showSecondaryActions: true, showSort: true, showPanelFilter: true }),
            selected ? React.createElement(OpenLibraryPanelModal, { onDismiss: () => setSelected(undefined), libraryPanel: selected }) : null)));
}
export default connector(FolderLibraryPanelsPage);
//# sourceMappingURL=FolderLibraryPanelsPage.js.map