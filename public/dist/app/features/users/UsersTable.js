import React from 'react';
var UsersTable = function (props) {
    var users = props.users, onRoleChange = props.onRoleChange, onRemoveUser = props.onRemoveUser;
    return (React.createElement("table", { className: "filter-table form-inline" },
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", null),
                React.createElement("th", null, "Login"),
                React.createElement("th", null, "Email"),
                React.createElement("th", null, "Seen"),
                React.createElement("th", null, "Role"),
                React.createElement("th", { style: { width: '34px' } }))),
        React.createElement("tbody", null, users.map(function (user, index) {
            return (React.createElement("tr", { key: user.userId + "-" + index },
                React.createElement("td", { className: "width-4 text-center" },
                    React.createElement("img", { className: "filter-table__avatar", src: user.avatarUrl })),
                React.createElement("td", null, user.login),
                React.createElement("td", null,
                    React.createElement("span", { className: "ellipsis" }, user.email)),
                React.createElement("td", null, user.lastSeenAtAge),
                React.createElement("td", null,
                    React.createElement("div", { className: "gf-form-select-wrapper width-12" },
                        React.createElement("select", { value: user.role, className: "gf-form-input", onChange: function (event) { return onRoleChange(event.target.value, user); } }, ['Viewer', 'Editor', 'Admin'].map(function (option, index) {
                            return (React.createElement("option", { value: option, key: option + "-" + index }, option));
                        })))),
                React.createElement("td", null,
                    React.createElement("div", { onClick: function () { return onRemoveUser(user); }, className: "btn btn-danger btn-mini" },
                        React.createElement("i", { className: "fa fa-remove" })))));
        }))));
};
export default UsersTable;
//# sourceMappingURL=UsersTable.js.map