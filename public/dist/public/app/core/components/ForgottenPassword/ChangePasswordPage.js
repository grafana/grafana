import React from 'react';
import { LoginLayout, InnerBox } from '../Login/LoginLayout';
import { ChangePassword } from './ChangePassword';
import LoginCtrl from '../Login/LoginCtrl';
export var ChangePasswordPage = function (props) {
    return (React.createElement(LoginLayout, null,
        React.createElement(InnerBox, null,
            React.createElement(LoginCtrl, { resetCode: props.queryParams.code }, function (_a) {
                var changePassword = _a.changePassword;
                return React.createElement(ChangePassword, { onSubmit: changePassword });
            }))));
};
export default ChangePasswordPage;
//# sourceMappingURL=ChangePasswordPage.js.map