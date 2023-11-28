import { css } from '@emotion/css';
import React from 'react';
import { Checkbox, Button, Tag, ModalsController } from '@grafana/ui';
import { RevertDashboardModal } from './RevertDashboardModal';
export const VersionHistoryTable = ({ versions, canCompare, onCheck }) => (React.createElement("table", { className: "filter-table gf-form-group" },
    React.createElement("thead", null,
        React.createElement("tr", null,
            React.createElement("th", { className: "width-4" }),
            React.createElement("th", { className: "width-4" }, "Version"),
            React.createElement("th", { className: "width-14" }, "Date"),
            React.createElement("th", { className: "width-10" }, "Updated by"),
            React.createElement("th", null, "Notes"),
            React.createElement("th", null))),
    React.createElement("tbody", null, versions.map((version, idx) => (React.createElement("tr", { key: version.id },
        React.createElement("td", null,
            React.createElement(Checkbox, { "aria-label": `Toggle selection of version ${version.version}`, className: css `
                display: inline;
              `, checked: version.checked, onChange: (ev) => onCheck(ev, version.id), disabled: !version.checked && canCompare })),
        React.createElement("td", null, version.version),
        React.createElement("td", null, version.createdDateString),
        React.createElement("td", null, version.createdBy),
        React.createElement("td", null, version.message),
        React.createElement("td", { className: "text-right" }, idx === 0 ? (React.createElement(Tag, { name: "Latest", colorIndex: 17 })) : (React.createElement(ModalsController, null, ({ showModal, hideModal }) => (React.createElement(Button, { variant: "secondary", size: "sm", icon: "history", onClick: () => {
                showModal(RevertDashboardModal, {
                    version: version.version,
                    hideModal,
                });
            } }, "Restore")))))))))));
//# sourceMappingURL=VersionHistoryTable.js.map