import * as tslib_1 from "tslib";
import React, { createRef, PureComponent } from 'react';
import { connect } from 'react-redux';
import { revokeInvite } from './state/actions';
var InviteeRow = /** @class */ (function (_super) {
    tslib_1.__extends(InviteeRow, _super);
    function InviteeRow() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.copyUrlRef = createRef();
        _this.copyToClipboard = function () {
            var node = _this.copyUrlRef.current;
            if (node) {
                node.select();
                document.execCommand('copy');
            }
        };
        return _this;
    }
    InviteeRow.prototype.render = function () {
        var _a = this.props, invitee = _a.invitee, revokeInvite = _a.revokeInvite;
        return (React.createElement("tr", null,
            React.createElement("td", null, invitee.email),
            React.createElement("td", null, invitee.name),
            React.createElement("td", { className: "text-right" },
                React.createElement("button", { className: "btn btn-inverse btn-mini", onClick: this.copyToClipboard },
                    React.createElement("textarea", { readOnly: true, value: invitee.url, style: { position: 'absolute', right: -1000 }, ref: this.copyUrlRef }),
                    React.createElement("i", { className: "fa fa-clipboard" }),
                    " Copy Invite"),
                "\u00A0"),
            React.createElement("td", null,
                React.createElement("button", { className: "btn btn-danger btn-mini", onClick: function () { return revokeInvite(invitee.code); } },
                    React.createElement("i", { className: "fa fa-remove" })))));
    };
    return InviteeRow;
}(PureComponent));
var mapDispatchToProps = {
    revokeInvite: revokeInvite,
};
export default connect(function () {
    return {};
}, mapDispatchToProps)(InviteeRow);
//# sourceMappingURL=InviteeRow.js.map