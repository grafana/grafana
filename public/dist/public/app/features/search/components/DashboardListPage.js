import { __assign } from "tslib";
import React, { memo } from 'react';
import { useAsync } from 'react-use';
import { connect } from 'react-redux';
import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { loadFolderPage } from '../loaders';
import ManageDashboards from './ManageDashboards';
export var DashboardListPage = memo(function (_a) {
    var _b;
    var navModel = _a.navModel, match = _a.match, location = _a.location;
    var _c = useAsync(function () {
        var uid = match.params.uid;
        var url = location.pathname;
        if (!uid || !url.startsWith('/dashboards')) {
            return Promise.resolve({ pageNavModel: navModel });
        }
        return loadFolderPage(uid).then(function (_a) {
            var folder = _a.folder, folderNav = _a.folderNav;
            var path = locationUtil.stripBaseFromUrl(folder.url);
            if (path !== location.pathname) {
                locationService.push(path);
            }
            return { folder: folder, pageNavModel: __assign(__assign({}, navModel), { main: folderNav }) };
        });
    }, [match.params.uid]), loading = _c.loading, value = _c.value;
    return (React.createElement(Page, { navModel: (_b = value === null || value === void 0 ? void 0 : value.pageNavModel) !== null && _b !== void 0 ? _b : navModel },
        React.createElement(Page.Contents, { isLoading: loading },
            React.createElement(ManageDashboards, { folder: value === null || value === void 0 ? void 0 : value.folder }))));
});
DashboardListPage.displayName = 'DashboardListPage';
var mapStateToProps = function (state) {
    return {
        navModel: getNavModel(state.navIndex, 'manage-dashboards'),
    };
};
export default connect(mapStateToProps)(DashboardListPage);
//# sourceMappingURL=DashboardListPage.js.map