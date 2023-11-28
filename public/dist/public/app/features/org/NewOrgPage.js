import { __awaiter } from "tslib";
import React from 'react';
import { connect } from 'react-redux';
import { Button, Input, Field, Form, FieldSet } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { getConfig } from 'app/core/config';
import { createOrganization } from './state/actions';
const mapDispatchToProps = {
    createOrganization,
};
const connector = connect(undefined, mapDispatchToProps);
const pageNav = {
    icon: 'building',
    id: 'org-new',
    text: 'New organization',
};
export const NewOrgPage = ({ createOrganization }) => {
    const createOrg = (newOrg) => __awaiter(void 0, void 0, void 0, function* () {
        yield createOrganization(newOrg);
        window.location.href = getConfig().appSubUrl + '/org';
    });
    return (React.createElement(Page, { navId: "global-orgs", pageNav: pageNav },
        React.createElement(Page.Contents, null,
            React.createElement("p", { className: "muted" }, "Each organization contains their own dashboards, data sources, and configuration, which cannot be shared shared between organizations. While users might belong to more than one organization, multiple organizations are most frequently used in multi-tenant deployments."),
            React.createElement(Form, { onSubmit: createOrg }, ({ register, errors }) => {
                return (React.createElement(React.Fragment, null,
                    React.createElement(FieldSet, null,
                        React.createElement(Field, { label: "Organization name", invalid: !!errors.name, error: errors.name && errors.name.message },
                            React.createElement(Input, Object.assign({ placeholder: "Org name" }, register('name', {
                                required: 'Organization name is required',
                            }))))),
                    React.createElement(Button, { type: "submit" }, "Create")));
            }))));
};
export default connector(NewOrgPage);
//# sourceMappingURL=NewOrgPage.js.map