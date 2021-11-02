import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { Button, Icon, LoadingPlaceholder } from '@grafana/ui';
var UserSessions = /** @class */ (function (_super) {
    __extends(UserSessions, _super);
    function UserSessions() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    UserSessions.prototype.render = function () {
        var _a = this.props, isLoading = _a.isLoading, sessions = _a.sessions, revokeUserSession = _a.revokeUserSession;
        if (isLoading) {
            return React.createElement(LoadingPlaceholder, { text: "Loading sessions..." });
        }
        return (React.createElement("div", null, sessions.length > 0 && (React.createElement(React.Fragment, null,
            React.createElement("h3", { className: "page-sub-heading" }, "Sessions"),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("table", { className: "filter-table form-inline", "aria-label": "User sessions table" },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "Last seen"),
                            React.createElement("th", null, "Logged on"),
                            React.createElement("th", null, "IP address"),
                            React.createElement("th", null, "Browser & OS"),
                            React.createElement("th", null))),
                    React.createElement("tbody", null, sessions.map(function (session, index) { return (React.createElement("tr", { key: index },
                        session.isActive ? React.createElement("td", null, "Now") : React.createElement("td", null, session.seenAt),
                        React.createElement("td", null, session.createdAt),
                        React.createElement("td", null, session.clientIp),
                        React.createElement("td", null,
                            session.browser,
                            " on ",
                            session.os,
                            " ",
                            session.osVersion),
                        React.createElement("td", null,
                            React.createElement(Button, { size: "sm", variant: "destructive", onClick: function () { return revokeUserSession(session.id); }, "aria-label": "Revoke user session" },
                                React.createElement(Icon, { name: "power" }))))); }))))))));
    };
    return UserSessions;
}(PureComponent));
export { UserSessions };
export default UserSessions;
//# sourceMappingURL=UserSessions.js.map