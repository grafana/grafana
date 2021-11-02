import { __awaiter, __generator, __read } from "tslib";
import React, { useState } from 'react';
import { connect } from 'react-redux';
import { useAsync } from 'react-use';
import { getNavModel } from '../../core/selectors/navModel';
import { getLoadingNav } from './state/navModel';
import Page from '../../core/components/Page/Page';
import { LibraryPanelsSearch } from '../library-panels/components/LibraryPanelsSearch/LibraryPanelsSearch';
import { OpenLibraryPanelModal } from '../library-panels/components/OpenLibraryPanelModal/OpenLibraryPanelModal';
import { getFolderByUid } from './state/actions';
var mapStateToProps = function (state, props) {
    var uid = props.match.params.uid;
    return {
        navModel: getNavModel(state.navIndex, "folder-library-panels-" + uid, getLoadingNav(1)),
        folderUid: uid,
        folder: state.folder,
    };
};
var mapDispatchToProps = {
    getFolderByUid: getFolderByUid,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
export function FolderLibraryPanelsPage(_a) {
    var _this = this;
    var navModel = _a.navModel, getFolderByUid = _a.getFolderByUid, folderUid = _a.folderUid, folder = _a.folder;
    var loading = useAsync(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getFolderByUid(folderUid)];
            case 1: return [2 /*return*/, _a.sent()];
        }
    }); }); }, [getFolderByUid, folderUid]).loading;
    var _b = __read(useState(undefined), 2), selected = _b[0], setSelected = _b[1];
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, { isLoading: loading },
            React.createElement(LibraryPanelsSearch, { onClick: setSelected, currentFolderId: folder.id, showSecondaryActions: true, showSort: true, showPanelFilter: true }),
            selected ? React.createElement(OpenLibraryPanelModal, { onDismiss: function () { return setSelected(undefined); }, libraryPanel: selected }) : null)));
}
export default connector(FolderLibraryPanelsPage);
//# sourceMappingURL=FolderLibraryPanelsPage.js.map