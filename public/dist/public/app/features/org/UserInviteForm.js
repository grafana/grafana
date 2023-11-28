import { __awaiter, __rest } from "tslib";
import React from 'react';
import { locationUtil } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { locationService } from '@grafana/runtime';
import { Button, LinkButton, Input, Switch, RadioButtonGroup, Form, Field, InputControl, FieldSet, Icon, TextLink, Tooltip, Label, } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { OrgRole, useDispatch } from 'app/types';
import { addInvitee } from '../invites/state/actions';
const tooltipMessage = (React.createElement(React.Fragment, null,
    "You can now select the \"No basic role\" option and add permissions to your custom needs. You can find more information in\u00A0",
    React.createElement(TextLink, { href: "https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/#organization-roles", variant: "bodySmall", external: true }, "our documentation"),
    "."));
const roles = Object.values(OrgRole).map((r) => ({
    label: r === OrgRole.None ? 'No basic role' : r,
    value: r,
}));
const defaultValues = {
    name: '',
    email: '',
    role: OrgRole.Editor,
    sendEmail: true,
};
export const UserInviteForm = () => {
    const dispatch = useDispatch();
    const onSubmit = (formData) => __awaiter(void 0, void 0, void 0, function* () {
        yield dispatch(addInvitee(formData)).unwrap();
        locationService.push('/admin/users/');
    });
    return (React.createElement(Form, { defaultValues: defaultValues, onSubmit: onSubmit }, ({ register, control, errors }) => {
        return (React.createElement(React.Fragment, null,
            React.createElement(FieldSet, null,
                React.createElement(Field, { invalid: !!errors.loginOrEmail, error: !!errors.loginOrEmail ? 'Email or username is required' : undefined, label: "Email or username" },
                    React.createElement(Input, Object.assign({}, register('loginOrEmail', { required: true }), { placeholder: "email@example.com" }))),
                React.createElement(Field, { invalid: !!errors.name, label: "Name" },
                    React.createElement(Input, Object.assign({}, register('name'), { placeholder: "(optional)" }))),
                React.createElement(Field, { invalid: !!errors.role, label: React.createElement(Label, null,
                        React.createElement(Stack, { gap: 0.5 },
                            React.createElement("span", null, "Role"),
                            tooltipMessage && (React.createElement(Tooltip, { placement: "right-end", interactive: true, content: tooltipMessage },
                                React.createElement(Icon, { name: "info-circle", size: "xs" }))))) },
                    React.createElement(InputControl, { render: (_a) => {
                            var _b = _a.field, { ref } = _b, field = __rest(_b, ["ref"]);
                            return React.createElement(RadioButtonGroup, Object.assign({}, field, { options: roles }));
                        }, control: control, name: "role" })),
                React.createElement(Field, { label: "Send invite email" },
                    React.createElement(Switch, Object.assign({ id: "send-email-switch" }, register('sendEmail'))))),
            React.createElement(Stack, null,
                React.createElement(Button, { type: "submit" }, "Submit"),
                React.createElement(LinkButton, { href: locationUtil.assureBaseUrl(getConfig().appSubUrl + '/admin/users'), variant: "secondary" }, "Back"))));
    }));
};
export default UserInviteForm;
//# sourceMappingURL=UserInviteForm.js.map