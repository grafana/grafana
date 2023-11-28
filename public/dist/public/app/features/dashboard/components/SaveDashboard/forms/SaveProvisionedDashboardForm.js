import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import React, { useCallback, useState } from 'react';
import { Stack } from '@grafana/experimental';
import { Button, ClipboardButton, HorizontalGroup, TextArea } from '@grafana/ui';
export const SaveProvisionedDashboardForm = ({ dashboard, onCancel }) => {
    const [dashboardJSON, setDashboardJson] = useState(() => {
        const clone = dashboard.getSaveModelClone();
        delete clone.id;
        return JSON.stringify(clone, null, 2);
    });
    const saveToFile = useCallback(() => {
        const blob = new Blob([dashboardJSON], {
            type: 'application/json;charset=utf-8',
        });
        saveAs(blob, dashboard.title + '-' + new Date().getTime() + '.json');
    }, [dashboard.title, dashboardJSON]);
    return (React.createElement(React.Fragment, null,
        React.createElement(Stack, { direction: "column", gap: 2 },
            React.createElement("div", null,
                "This dashboard cannot be saved from the Grafana UI because it has been provisioned from another source. Copy the JSON or save it to a file below, then you can update your dashboard in the provisioning source.",
                React.createElement("br", null),
                React.createElement("i", null,
                    "See",
                    ' ',
                    React.createElement("a", { className: "external-link", href: "https://grafana.com/docs/grafana/latest/administration/provisioning/#dashboards", target: "_blank", rel: "noreferrer" }, "documentation"),
                    ' ',
                    "for more information about provisioning."),
                React.createElement("br", null),
                " ",
                React.createElement("br", null),
                React.createElement("strong", null, "File path: "),
                " ",
                dashboard.meta.provisionedExternalId),
            React.createElement(TextArea, { spellCheck: false, value: dashboardJSON, onChange: (e) => {
                    setDashboardJson(e.currentTarget.value);
                }, className: styles.json }),
            React.createElement(HorizontalGroup, null,
                React.createElement(Button, { variant: "secondary", onClick: onCancel, fill: "outline" }, "Cancel"),
                React.createElement(ClipboardButton, { icon: "copy", getText: () => dashboardJSON }, "Copy JSON to clipboard"),
                React.createElement(Button, { type: "submit", onClick: saveToFile }, "Save JSON to file")))));
};
const styles = {
    json: css `
    height: 400px;
    width: 100%;
    overflow: auto;
    resize: none;
    font-family: monospace;
  `,
};
//# sourceMappingURL=SaveProvisionedDashboardForm.js.map