import React from 'react';
import { connect } from 'react-redux';
import Page from 'app/core/components/Page/Page';
import { SnapshotListTable } from './components/SnapshotListTable';
import { getNavModel } from 'app/core/selectors/navModel';
export var SnapshotListPage = function (_a) {
    var navModel = _a.navModel, location = _a.location;
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement(SnapshotListTable, null))));
};
var mapStateToProps = function (state) { return ({
    navModel: getNavModel(state.navIndex, 'snapshots'),
}); };
export default connect(mapStateToProps)(SnapshotListPage);
//# sourceMappingURL=SnapshotListPage.js.map