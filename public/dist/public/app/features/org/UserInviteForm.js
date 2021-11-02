import { __assign, __awaiter, __generator, __rest } from "tslib";
import React from 'react';
import { HorizontalGroup, Button, LinkButton, Input, Switch, RadioButtonGroup, Form, Field, InputControl, } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { OrgRole } from 'app/types';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { appEvents } from 'app/core/core';
import { AppEvents, locationUtil } from '@grafana/data';
var roles = [
    { label: 'Viewer', value: OrgRole.Viewer },
    { label: 'Editor', value: OrgRole.Editor },
    { label: 'Admin', value: OrgRole.Admin },
];
export var UserInviteForm = function (_a) {
    var onSubmit = function (formData) { return __awaiter(void 0, void 0, void 0, function () {
        var err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getBackendSrv().post('/api/org/invites', formData)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _a.sent();
                    appEvents.emit(AppEvents.alertError, ['Failed to send invitation.', err_1.message]);
                    return [3 /*break*/, 3];
                case 3:
                    locationService.push('/org/users/');
                    return [2 /*return*/];
            }
        });
    }); };
    var defaultValues = {
        name: '',
        email: '',
        role: OrgRole.Editor,
        sendEmail: true,
    };
    return (React.createElement(Form, { defaultValues: defaultValues, onSubmit: onSubmit }, function (_a) {
        var register = _a.register, control = _a.control, errors = _a.errors;
        return (React.createElement(React.Fragment, null,
            React.createElement(Field, { invalid: !!errors.loginOrEmail, error: !!errors.loginOrEmail ? 'Email or username is required' : undefined, label: "Email or username" },
                React.createElement(Input, __assign({}, register('loginOrEmail', { required: true }), { placeholder: "email@example.com" }))),
            React.createElement(Field, { invalid: !!errors.name, label: "Name" },
                React.createElement(Input, __assign({}, register('name'), { placeholder: "(optional)" }))),
            React.createElement(Field, { invalid: !!errors.role, label: "Role" },
                React.createElement(InputControl, { render: function (_a) {
                        var _b = _a.field, ref = _b.ref, field = __rest(_b, ["ref"]);
                        return React.createElement(RadioButtonGroup, __assign({}, field, { options: roles }));
                    }, control: control, name: "role" })),
            React.createElement(Field, { label: "Send invite email" },
                React.createElement(Switch, __assign({ id: "send-email-switch" }, register('sendEmail')))),
            React.createElement(HorizontalGroup, null,
                React.createElement(Button, { type: "submit" }, "Submit"),
                React.createElement(LinkButton, { href: locationUtil.assureBaseUrl(getConfig().appSubUrl + '/org/users'), variant: "secondary" }, "Back"))));
    }));
};
export default UserInviteForm;
//# sourceMappingURL=UserInviteForm.js.map