import { __awaiter, __generator, __read } from "tslib";
import React, { useEffect } from 'react';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { useSelector } from 'react-redux';
import { LinkButton } from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';
import { AdminOrgsTable } from './AdminOrgsTable';
import useAsyncFn from 'react-use/lib/useAsyncFn';
var deleteOrg = function (orgId) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBackendSrv().delete('/api/orgs/' + orgId)];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
var getOrgs = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBackendSrv().get('/api/orgs')];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
export var AdminListOrgsPages = function () {
    var navIndex = useSelector(function (state) { return state.navIndex; });
    var navModel = getNavModel(navIndex, 'global-orgs');
    var _a = __read(useAsyncFn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getOrgs()];
            case 1: return [2 /*return*/, _a.sent()];
        }
    }); }); }, []), 2), state = _a[0], fetchOrgs = _a[1];
    useEffect(function () {
        fetchOrgs();
    }, [fetchOrgs]);
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement(React.Fragment, null,
                React.createElement("div", { className: "page-action-bar" },
                    React.createElement("div", { className: "page-action-bar__spacer" }),
                    React.createElement(LinkButton, { icon: "plus", href: "org/new" }, "New org")),
                state.loading && 'Fetching organizations',
                state.error,
                state.value && (React.createElement(AdminOrgsTable, { orgs: state.value, onDelete: function (orgId) {
                        deleteOrg(orgId).then(function () { return fetchOrgs(); });
                    } }))))));
};
export default AdminListOrgsPages;
//# sourceMappingURL=AdminListOrgsPage.js.map