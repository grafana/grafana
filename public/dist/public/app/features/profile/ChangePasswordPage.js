import React from 'react';
import { useMount } from 'react-use';
import { connect } from 'react-redux';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { ChangePasswordForm } from './ChangePasswordForm';
import { changePassword, loadUser } from './state/actions';
function mapStateToProps(state) {
    var userState = state.user;
    var isUpdating = userState.isUpdating, user = userState.user;
    return {
        navModel: getNavModel(state.navIndex, "change-password"),
        isUpdating: isUpdating,
        user: user,
    };
}
var mapDispatchToProps = {
    loadUser: loadUser,
    changePassword: changePassword,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
export function ChangePasswordPage(_a) {
    var navModel = _a.navModel, loadUser = _a.loadUser, isUpdating = _a.isUpdating, user = _a.user, changePassword = _a.changePassword;
    useMount(function () { return loadUser(); });
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, { isLoading: !Boolean(user) }, user ? (React.createElement(React.Fragment, null,
            React.createElement("h3", { className: "page-heading" }, "Change Your Password"),
            React.createElement(ChangePasswordForm, { user: user, onChangePassword: changePassword, isSaving: isUpdating }))) : null)));
}
export default connector(ChangePasswordPage);
//# sourceMappingURL=ChangePasswordPage.js.map