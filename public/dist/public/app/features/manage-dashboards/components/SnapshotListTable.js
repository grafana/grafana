import { __assign, __awaiter, __generator, __read } from "tslib";
import React, { useState, useCallback } from 'react';
import { ConfirmModal, Button, LinkButton } from '@grafana/ui';
import { getBackendSrv, locationService } from '@grafana/runtime';
import useAsync from 'react-use/lib/useAsync';
export function getSnapshots() {
    return getBackendSrv()
        .get('/api/dashboard/snapshots')
        .then(function (result) {
        return result.map(function (snapshot) { return (__assign(__assign({}, snapshot), { url: "/dashboard/snapshot/" + snapshot.key })); });
    });
}
export var SnapshotListTable = function () {
    var _a = __read(useState([]), 2), snapshots = _a[0], setSnapshots = _a[1];
    var _b = __read(useState(), 2), removeSnapshot = _b[0], setRemoveSnapshot = _b[1];
    var currentPath = locationService.getLocation().pathname;
    var fullUrl = window.location.href;
    var baseUrl = fullUrl.substr(0, fullUrl.indexOf(currentPath));
    useAsync(function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getSnapshots()];
                case 1:
                    response = _a.sent();
                    setSnapshots(response);
                    return [2 /*return*/];
            }
        });
    }); }, [setSnapshots]);
    var doRemoveSnapshot = useCallback(function (snapshot) { return __awaiter(void 0, void 0, void 0, function () {
        var filteredSnapshots;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    filteredSnapshots = snapshots.filter(function (ss) { return ss.key !== snapshot.key; });
                    setSnapshots(filteredSnapshots);
                    return [4 /*yield*/, getBackendSrv()
                            .delete("/api/snapshots/" + snapshot.key)
                            .catch(function () {
                            setSnapshots(snapshots);
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [snapshots]);
    return (React.createElement("div", null,
        React.createElement("table", { className: "filter-table" },
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null,
                        React.createElement("strong", null, "Name")),
                    React.createElement("th", null,
                        React.createElement("strong", null, "Snapshot url")),
                    React.createElement("th", { style: { width: '70px' } }),
                    React.createElement("th", { style: { width: '30px' } }),
                    React.createElement("th", { style: { width: '25px' } }))),
            React.createElement("tbody", null, snapshots.map(function (snapshot) {
                var url = snapshot.externalUrl || snapshot.url;
                var fullUrl = snapshot.externalUrl || "" + baseUrl + snapshot.url;
                return (React.createElement("tr", { key: snapshot.key },
                    React.createElement("td", null,
                        React.createElement("a", { href: url }, snapshot.name)),
                    React.createElement("td", null,
                        React.createElement("a", { href: url }, fullUrl)),
                    React.createElement("td", null, snapshot.external && React.createElement("span", { className: "query-keyword" }, "External")),
                    React.createElement("td", { className: "text-center" },
                        React.createElement(LinkButton, { href: url, variant: "secondary", size: "sm", icon: "eye" }, "View")),
                    React.createElement("td", { className: "text-right" },
                        React.createElement(Button, { variant: "destructive", size: "sm", icon: "times", onClick: function () { return setRemoveSnapshot(snapshot); } }))));
            }))),
        React.createElement(ConfirmModal, { isOpen: !!removeSnapshot, icon: "trash-alt", title: "Delete", body: "Are you sure you want to delete '" + (removeSnapshot === null || removeSnapshot === void 0 ? void 0 : removeSnapshot.name) + "'?", confirmText: "Delete", onDismiss: function () { return setRemoveSnapshot(undefined); }, onConfirm: function () {
                doRemoveSnapshot(removeSnapshot);
                setRemoveSnapshot(undefined);
            } })));
};
//# sourceMappingURL=SnapshotListTable.js.map