import React from 'react';
import LoginCtrl from '../Login/LoginCtrl';
import { LoginLayout, InnerBox } from '../Login/LoginLayout';
import { ChangePassword } from './ChangePassword';
export const ChangePasswordPage = (props) => {
    return (React.createElement(LoginLayout, { isChangingPassword: true },
        React.createElement(InnerBox, null,
            React.createElement(LoginCtrl, { resetCode: props.queryParams.code }, ({ changePassword }) => React.createElement(ChangePassword, { onSubmit: changePassword })))));
};
export default ChangePasswordPage;
//# sourceMappingURL=ChangePasswordPage.js.map