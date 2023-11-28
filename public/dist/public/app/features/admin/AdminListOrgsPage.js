import { __awaiter } from "tslib";
import React, { useEffect } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';
import { AdminOrgsTable } from './AdminOrgsTable';
const deleteOrg = (orgId) => __awaiter(void 0, void 0, void 0, function* () {
    return yield getBackendSrv().delete('/api/orgs/' + orgId);
});
const getOrgs = () => __awaiter(void 0, void 0, void 0, function* () {
    return yield getBackendSrv().get('/api/orgs');
});
const getErrorMessage = (error) => {
    var _a;
    return isFetchError(error) ? (_a = error === null || error === void 0 ? void 0 : error.data) === null || _a === void 0 ? void 0 : _a.message : 'An unexpected error happened.';
};
export default function AdminListOrgsPages() {
    const [state, fetchOrgs] = useAsyncFn(() => __awaiter(this, void 0, void 0, function* () { return yield getOrgs(); }), []);
    const canCreateOrg = contextSrv.hasPermission(AccessControlAction.OrgsCreate);
    useEffect(() => {
        fetchOrgs();
    }, [fetchOrgs]);
    return (React.createElement(Page, { navId: "global-orgs" },
        React.createElement(Page.Contents, null,
            React.createElement(React.Fragment, null,
                React.createElement("div", { className: "page-action-bar" },
                    React.createElement("div", { className: "page-action-bar__spacer" }),
                    React.createElement(LinkButton, { icon: "plus", href: "org/new", disabled: !canCreateOrg }, "New org")),
                state.error && getErrorMessage(state.error),
                state.loading && 'Fetching organizations',
                state.value && (React.createElement(AdminOrgsTable, { orgs: state.value, onDelete: (orgId) => {
                        deleteOrg(orgId).then(() => fetchOrgs());
                    } }))))));
}
//# sourceMappingURL=AdminListOrgsPage.js.map