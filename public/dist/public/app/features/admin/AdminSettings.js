import React from 'react';
import { useAsync } from 'react-use';
import { getBackendSrv } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
function AdminSettings() {
    const { loading, value: settings } = useAsync(() => getBackendSrv().get('/api/admin/settings'), []);
    return (React.createElement(Page, { navId: "server-settings" },
        React.createElement(Page.Contents, { isLoading: loading },
            React.createElement("div", { className: "grafana-info-box span8", style: { margin: '20px 0 25px 0' } }, "These system settings are defined in grafana.ini or custom.ini (or overridden in ENV variables). To change these you currently need to restart Grafana."),
            settings && (React.createElement("table", { className: "filter-table" },
                React.createElement("tbody", null, Object.entries(settings).map(([sectionName, sectionSettings], i) => (React.createElement(React.Fragment, { key: `section-${i}` },
                    React.createElement("tr", null,
                        React.createElement("td", { className: "admin-settings-section" }, sectionName),
                        React.createElement("td", null)),
                    Object.entries(sectionSettings).map(([settingName, settingValue], j) => (React.createElement("tr", { key: `property-${j}` },
                        React.createElement("td", { style: { paddingLeft: '25px' } }, settingName),
                        React.createElement("td", { style: { whiteSpace: 'break-spaces' } }, settingValue)))))))))))));
}
export default AdminSettings;
//# sourceMappingURL=AdminSettings.js.map