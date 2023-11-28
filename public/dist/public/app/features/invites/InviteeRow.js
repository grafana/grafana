import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Button, ClipboardButton } from '@grafana/ui';
import { revokeInvite } from './state/actions';
const mapDispatchToProps = {
    revokeInvite,
};
const connector = connect(null, mapDispatchToProps);
class InviteeRow extends PureComponent {
    render() {
        const { invitee, revokeInvite } = this.props;
        return (React.createElement("tr", null,
            React.createElement("td", null, invitee.email),
            React.createElement("td", null, invitee.name),
            React.createElement("td", { className: "text-right" },
                React.createElement(ClipboardButton, { icon: "copy", variant: "secondary", size: "sm", getText: () => invitee.url }, "Copy Invite"),
                "\u00A0"),
            React.createElement("td", null,
                React.createElement(Button, { variant: "destructive", size: "sm", icon: "times", onClick: () => revokeInvite(invitee.code), "aria-label": "Revoke Invite" }))));
    }
}
export default connector(InviteeRow);
//# sourceMappingURL=InviteeRow.js.map