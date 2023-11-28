import React from 'react';
import { Input, Field, FieldSet, Button, Form } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
const OrgProfile = ({ onSubmit, orgName }) => {
    const canWriteOrg = contextSrv.hasPermission(AccessControlAction.OrgsWrite);
    return (React.createElement(Form, { defaultValues: { orgName }, onSubmit: ({ orgName }) => onSubmit(orgName) }, ({ register }) => (React.createElement(FieldSet, { label: "Organization profile", disabled: !canWriteOrg },
        React.createElement(Field, { label: "Organization name" },
            React.createElement(Input, Object.assign({ id: "org-name-input", type: "text" }, register('orgName', { required: true })))),
        React.createElement(Button, { type: "submit" }, "Update organization name")))));
};
export default OrgProfile;
//# sourceMappingURL=OrgProfile.js.map