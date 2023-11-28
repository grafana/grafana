import React, { PureComponent } from 'react';
import { dateTimeFormat } from '@grafana/data';
import { Button, Spinner } from '@grafana/ui';
const format = 'dddd YYYY-MM-DD HH:mm zz';
export class LdapSyncInfo extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            isSyncing: false,
        };
        this.handleSyncClick = () => {
            this.setState({ isSyncing: !this.state.isSyncing });
        };
    }
    render() {
        const { ldapSyncInfo } = this.props;
        const { isSyncing } = this.state;
        const nextSyncTime = dateTimeFormat(ldapSyncInfo.nextSync, { format });
        return (React.createElement(React.Fragment, null,
            React.createElement("h3", { className: "page-heading" },
                "LDAP Synchronisation",
                React.createElement(Button, { className: "pull-right", onClick: this.handleSyncClick, hidden: true },
                    React.createElement("span", { className: "btn-title" }, "Bulk-sync now"),
                    isSyncing && React.createElement(Spinner, { inline: true }))),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("table", { className: "filter-table form-inline" },
                        React.createElement("tbody", null,
                            React.createElement("tr", null,
                                React.createElement("td", null, "Active synchronisation"),
                                React.createElement("td", { colSpan: 2 }, ldapSyncInfo.enabled ? 'Enabled' : 'Disabled')),
                            React.createElement("tr", null,
                                React.createElement("td", null, "Scheduled"),
                                React.createElement("td", null, ldapSyncInfo.schedule)),
                            React.createElement("tr", null,
                                React.createElement("td", null, "Next scheduled synchronisation"),
                                React.createElement("td", null, nextSyncTime))))))));
    }
}
//# sourceMappingURL=LdapSyncInfo.js.map