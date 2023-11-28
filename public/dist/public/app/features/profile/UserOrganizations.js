import React, { PureComponent } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Button, LoadingPlaceholder } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
export class UserOrganizations extends PureComponent {
    render() {
        const { isLoading, orgs, user } = this.props;
        if (isLoading) {
            return React.createElement(LoadingPlaceholder, { text: "Loading organizations..." });
        }
        if (orgs.length === 0) {
            return null;
        }
        return (React.createElement("div", null,
            React.createElement("h3", { className: "page-sub-heading" },
                React.createElement(Trans, { i18nKey: "user-orgs.title" }, "Organizations")),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("table", { className: "filter-table form-inline", "data-testid": selectors.components.UserProfile.orgsTable },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null,
                                React.createElement(Trans, { i18nKey: "user-orgs.name-column" }, "Name")),
                            React.createElement("th", null,
                                React.createElement(Trans, { i18nKey: "user-orgs.role-column" }, "Role")),
                            React.createElement("th", null))),
                    React.createElement("tbody", null, orgs.map((org, index) => {
                        return (React.createElement("tr", { key: index },
                            React.createElement("td", null, org.name),
                            React.createElement("td", null, org.role),
                            React.createElement("td", { className: "text-right" }, org.orgId === (user === null || user === void 0 ? void 0 : user.orgId) ? (React.createElement(Button, { variant: "secondary", size: "sm", disabled: true },
                                React.createElement(Trans, { i18nKey: "user-orgs.current-org-button" }, "Current"))) : (React.createElement(Button, { variant: "secondary", size: "sm", onClick: () => {
                                    this.props.setUserOrg(org);
                                } },
                                React.createElement(Trans, { i18nKey: "user-orgs.select-org-button" }, "Select organisation"))))));
                    }))))));
    }
}
export default UserOrganizations;
//# sourceMappingURL=UserOrganizations.js.map