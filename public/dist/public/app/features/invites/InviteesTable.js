import React, { PureComponent } from 'react';
import InviteeRow from './InviteeRow';
export default class InviteesTable extends PureComponent {
    render() {
        const { invitees } = this.props;
        return (React.createElement("table", { className: "filter-table form-inline" },
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "Email"),
                    React.createElement("th", null, "Name"),
                    React.createElement("th", null),
                    React.createElement("th", { style: { width: '34px' } }))),
            React.createElement("tbody", { "data-testid": "InviteesTable-body" }, invitees.map((invitee, index) => {
                return React.createElement(InviteeRow, { key: `${invitee.id}-${index}`, invitee: invitee });
            }))));
    }
}
//# sourceMappingURL=InviteesTable.js.map