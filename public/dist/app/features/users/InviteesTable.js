import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import InviteeRow from './InviteeRow';
var InviteesTable = /** @class */ (function (_super) {
    tslib_1.__extends(InviteesTable, _super);
    function InviteesTable() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    InviteesTable.prototype.render = function () {
        var invitees = this.props.invitees;
        return (React.createElement("table", { className: "filter-table form-inline" },
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "Email"),
                    React.createElement("th", null, "Name"),
                    React.createElement("th", null),
                    React.createElement("th", { style: { width: '34px' } }))),
            React.createElement("tbody", null, invitees.map(function (invitee, index) {
                return React.createElement(InviteeRow, { key: invitee.id + "-" + index, invitee: invitee });
            }))));
    };
    return InviteesTable;
}(PureComponent));
export default InviteesTable;
//# sourceMappingURL=InviteesTable.js.map