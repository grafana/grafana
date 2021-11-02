import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Checkbox, Button, Tag, ModalsController } from '@grafana/ui';
import { RevertDashboardModal } from './RevertDashboardModal';
export var VersionHistoryTable = function (_a) {
    var versions = _a.versions, onCheck = _a.onCheck;
    return (React.createElement("table", { className: "filter-table gf-form-group" },
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", { className: "width-4" }),
                React.createElement("th", { className: "width-4" }, "Version"),
                React.createElement("th", { className: "width-14" }, "Date"),
                React.createElement("th", { className: "width-10" }, "Updated by"),
                React.createElement("th", null, "Notes"),
                React.createElement("th", null))),
        React.createElement("tbody", null, versions.map(function (version, idx) { return (React.createElement("tr", { key: version.id },
            React.createElement("td", null,
                React.createElement(Checkbox, { "aria-label": "Toggle selection of version " + version.version, className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n                display: inline;\n              "], ["\n                display: inline;\n              "]))), checked: version.checked, onChange: function (ev) { return onCheck(ev, version.id); } })),
            React.createElement("td", null, version.version),
            React.createElement("td", null, version.createdDateString),
            React.createElement("td", null, version.createdBy),
            React.createElement("td", null, version.message),
            React.createElement("td", { className: "text-right" }, idx === 0 ? (React.createElement(Tag, { name: "Latest", colorIndex: 17 })) : (React.createElement(ModalsController, null, function (_a) {
                var showModal = _a.showModal, hideModal = _a.hideModal;
                return (React.createElement(Button, { variant: "secondary", size: "sm", icon: "history", onClick: function () {
                        showModal(RevertDashboardModal, {
                            version: version.version,
                            hideModal: hideModal,
                        });
                    } }, "Restore"));
            }))))); }))));
};
var templateObject_1;
//# sourceMappingURL=VersionHistoryTable.js.map