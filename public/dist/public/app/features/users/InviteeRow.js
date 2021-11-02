import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { revokeInvite } from './state/actions';
import { Button, ClipboardButton } from '@grafana/ui';
var mapDispatchToProps = {
    revokeInvite: revokeInvite,
};
var connector = connect(null, mapDispatchToProps);
var InviteeRow = /** @class */ (function (_super) {
    __extends(InviteeRow, _super);
    function InviteeRow() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    InviteeRow.prototype.render = function () {
        var _a = this.props, invitee = _a.invitee, revokeInvite = _a.revokeInvite;
        return (React.createElement("tr", null,
            React.createElement("td", null, invitee.email),
            React.createElement("td", null, invitee.name),
            React.createElement("td", { className: "text-right" },
                React.createElement(ClipboardButton, { variant: "secondary", size: "sm", getText: function () { return invitee.url; } }, "Copy Invite"),
                "\u00A0"),
            React.createElement("td", null,
                React.createElement(Button, { variant: "destructive", size: "sm", icon: "times", onClick: function () { return revokeInvite(invitee.code); } }))));
    };
    return InviteeRow;
}(PureComponent));
export default connector(InviteeRow);
//# sourceMappingURL=InviteeRow.js.map