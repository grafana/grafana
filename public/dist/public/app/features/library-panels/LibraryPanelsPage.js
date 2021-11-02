import { __read } from "tslib";
import React, { useState } from 'react';
import { connect } from 'react-redux';
import { getNavModel } from '../../core/selectors/navModel';
import Page from '../../core/components/Page/Page';
import { LibraryPanelsSearch } from './components/LibraryPanelsSearch/LibraryPanelsSearch';
import { OpenLibraryPanelModal } from './components/OpenLibraryPanelModal/OpenLibraryPanelModal';
var mapStateToProps = function (state) { return ({
    navModel: getNavModel(state.navIndex, 'library-panels'),
}); };
var connector = connect(mapStateToProps, undefined);
export var LibraryPanelsPage = function (_a) {
    var navModel = _a.navModel;
    var _b = __read(useState(undefined), 2), selected = _b[0], setSelected = _b[1];
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement(LibraryPanelsSearch, { onClick: setSelected, showSecondaryActions: true, showSort: true, showPanelFilter: true, showFolderFilter: true }),
            selected ? React.createElement(OpenLibraryPanelModal, { onDismiss: function () { return setSelected(undefined); }, libraryPanel: selected }) : null)));
};
export default connect(mapStateToProps)(LibraryPanelsPage);
//# sourceMappingURL=LibraryPanelsPage.js.map