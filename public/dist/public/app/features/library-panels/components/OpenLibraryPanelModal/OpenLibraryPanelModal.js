import { __awaiter, __generator, __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { AsyncSelect, Button, Modal, useStyles2 } from '@grafana/ui';
import { urlUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { getConnectedDashboards, getLibraryPanelConnectedDashboards } from '../../state/api';
import { debounce } from 'lodash';
export function OpenLibraryPanelModal(_a) {
    var _this = this;
    var libraryPanel = _a.libraryPanel, onDismiss = _a.onDismiss;
    var styles = useStyles2(getStyles);
    var _b = __read(useState(false), 2), loading = _b[0], setLoading = _b[1];
    var _c = __read(useState(0), 2), connected = _c[0], setConnected = _c[1];
    var _d = __read(useState(undefined), 2), option = _d[0], setOption = _d[1];
    useEffect(function () {
        var getConnected = function () { return __awaiter(_this, void 0, void 0, function () {
            var connectedDashboards;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getLibraryPanelConnectedDashboards(libraryPanel.uid)];
                    case 1:
                        connectedDashboards = _a.sent();
                        setConnected(connectedDashboards.length);
                        return [2 /*return*/];
                }
            });
        }); };
        getConnected();
    }, [libraryPanel.uid]);
    var loadOptions = useCallback(function (searchString) { return loadOptionsAsync(libraryPanel.uid, searchString, setLoading); }, [libraryPanel.uid]);
    var debouncedLoadOptions = useMemo(function () { return debounce(loadOptions, 300, { leading: true, trailing: true }); }, [
        loadOptions,
    ]);
    var onViewPanel = function (e) {
        var _a;
        e.preventDefault();
        locationService.push(urlUtil.renderUrl("/d/" + ((_a = option === null || option === void 0 ? void 0 : option.value) === null || _a === void 0 ? void 0 : _a.uid), {}));
    };
    return (React.createElement(Modal, { title: "View panel in dashboard", onDismiss: onDismiss, onClickBackdrop: onDismiss, isOpen: true },
        React.createElement("div", { className: styles.container },
            connected === 0 ? (React.createElement("span", null, "Panel is not linked to a dashboard. Add the panel to a dashboard and retry.")) : null,
            connected > 0 ? (React.createElement(React.Fragment, null,
                React.createElement("p", null,
                    "This panel is being used in",
                    ' ',
                    React.createElement("strong", null,
                        connected,
                        " ",
                        connected > 1 ? 'dashboards' : 'dashboard'),
                    ".Please choose which dashboard to view the panel in:"),
                React.createElement(AsyncSelect, { menuShouldPortal: true, isClearable: true, isLoading: loading, defaultOptions: true, loadOptions: debouncedLoadOptions, onChange: setOption, placeholder: "Start typing to search for dashboard", noOptionsMessage: "No dashboards found" }))) : null),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" }, "Cancel"),
            React.createElement(Button, { onClick: onViewPanel, disabled: !Boolean(option) }, option ? "View panel in " + (option === null || option === void 0 ? void 0 : option.label) + "..." : 'View panel in dashboard...'))));
}
function loadOptionsAsync(uid, searchString, setLoading) {
    return __awaiter(this, void 0, void 0, function () {
        var searchHits, options;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setLoading(true);
                    return [4 /*yield*/, getConnectedDashboards(uid)];
                case 1:
                    searchHits = _a.sent();
                    options = searchHits
                        .filter(function (d) { return d.title.toLowerCase().includes(searchString.toLowerCase()); })
                        .map(function (d) { return ({ label: d.title, value: d }); });
                    setLoading(false);
                    return [2 /*return*/, options];
            }
        });
    });
}
function getStyles(theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject([""], [""]))),
    };
}
var templateObject_1;
//# sourceMappingURL=OpenLibraryPanelModal.js.map