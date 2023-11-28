import { __awaiter } from "tslib";
import React, { useState, useCallback } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { getBackendSrv, config } from '@grafana/runtime';
import { ConfirmModal, Button, LinkButton } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
export function getSnapshots() {
    return getBackendSrv()
        .get('/api/dashboard/snapshots')
        .then((result) => {
        return result.map((snapshot) => (Object.assign(Object.assign({}, snapshot), { url: `${config.appUrl}dashboard/snapshot/${snapshot.key}` })));
    });
}
export const SnapshotListTable = () => {
    const [snapshots, setSnapshots] = useState([]);
    const [removeSnapshot, setRemoveSnapshot] = useState();
    useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield getSnapshots();
        setSnapshots(response);
    }), [setSnapshots]);
    const doRemoveSnapshot = useCallback((snapshot) => __awaiter(void 0, void 0, void 0, function* () {
        const filteredSnapshots = snapshots.filter((ss) => ss.key !== snapshot.key);
        setSnapshots(filteredSnapshots);
        yield getBackendSrv()
            .delete(`/api/snapshots/${snapshot.key}`)
            .catch(() => {
            setSnapshots(snapshots);
        });
    }), [snapshots]);
    return (React.createElement("div", null,
        React.createElement("table", { className: "filter-table" },
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null,
                        React.createElement("strong", null,
                            React.createElement(Trans, { i18nKey: "snapshot.name-column-header" }, "Name"))),
                    React.createElement("th", null,
                        React.createElement("strong", null,
                            React.createElement(Trans, { i18nKey: "snapshot.url-column-header" }, "Snapshot url"))),
                    React.createElement("th", { style: { width: '70px' } }),
                    React.createElement("th", { style: { width: '30px' } }),
                    React.createElement("th", { style: { width: '25px' } }))),
            React.createElement("tbody", null, snapshots.map((snapshot) => {
                const url = snapshot.externalUrl || snapshot.url;
                return (React.createElement("tr", { key: snapshot.key },
                    React.createElement("td", null,
                        React.createElement("a", { href: url }, snapshot.name)),
                    React.createElement("td", null,
                        React.createElement("a", { href: url }, url)),
                    React.createElement("td", null, snapshot.external && (React.createElement("span", { className: "query-keyword" },
                        React.createElement(Trans, { i18nKey: "snapshot.external-badge" }, "External")))),
                    React.createElement("td", { className: "text-center" },
                        React.createElement(LinkButton, { href: url, variant: "secondary", size: "sm", icon: "eye" },
                            React.createElement(Trans, { i18nKey: "snapshot.view-button" }, "View"))),
                    React.createElement("td", { className: "text-right" },
                        React.createElement(Button, { variant: "destructive", size: "sm", icon: "times", onClick: () => setRemoveSnapshot(snapshot) }))));
            }))),
        React.createElement(ConfirmModal, { isOpen: !!removeSnapshot, icon: "trash-alt", title: "Delete", body: `Are you sure you want to delete '${removeSnapshot === null || removeSnapshot === void 0 ? void 0 : removeSnapshot.name}'?`, confirmText: "Delete", onDismiss: () => setRemoveSnapshot(undefined), onConfirm: () => {
                doRemoveSnapshot(removeSnapshot);
                setRemoveSnapshot(undefined);
            } })));
};
//# sourceMappingURL=SnapshotListTable.js.map