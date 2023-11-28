import React, { PureComponent } from 'react';
import { LoadingPlaceholder } from '@grafana/ui';
export class UserTeams extends PureComponent {
    render() {
        const { isLoading, teams } = this.props;
        if (isLoading) {
            return React.createElement(LoadingPlaceholder, { text: "Loading teams..." });
        }
        if (teams.length === 0) {
            return null;
        }
        return (React.createElement("div", null,
            React.createElement("h3", { className: "page-sub-heading" }, "Teams"),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("table", { className: "filter-table form-inline", "aria-label": "User teams table" },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null),
                            React.createElement("th", null, "Name"),
                            React.createElement("th", null, "Email"),
                            React.createElement("th", null, "Members"))),
                    React.createElement("tbody", null, teams.map((team, index) => {
                        return (React.createElement("tr", { key: index },
                            React.createElement("td", { className: "width-4 text-center" },
                                React.createElement("img", { className: "filter-table__avatar", src: team.avatarUrl, alt: "" })),
                            React.createElement("td", null, team.name),
                            React.createElement("td", null, team.email),
                            React.createElement("td", null, team.memberCount)));
                    }))))));
    }
}
export default UserTeams;
//# sourceMappingURL=UserTeams.js.map