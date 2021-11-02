import { __assign } from "tslib";
import React from 'react';
import { Input, Field, FieldSet, Button, Form } from '@grafana/ui';
var OrgProfile = function (_a) {
    var onSubmit = _a.onSubmit, orgName = _a.orgName;
    return (React.createElement(Form, { defaultValues: { orgName: orgName }, onSubmit: function (_a) {
            var orgName = _a.orgName;
            return onSubmit(orgName);
        } }, function (_a) {
        var register = _a.register;
        return (React.createElement(FieldSet, { label: "Organization profile" },
            React.createElement(Field, { label: "Organization name" },
                React.createElement(Input, __assign({ id: "org-name-input", type: "text" }, register('orgName', { required: true })))),
            React.createElement(Button, { type: "submit" }, "Update organization name")));
    }));
};
export default OrgProfile;
//# sourceMappingURL=OrgProfile.js.map