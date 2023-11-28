import React from 'react';
import { connect } from 'react-redux';
import { useMount } from 'react-use';
import { Page } from 'app/core/components/Page/Page';
import { ChangePasswordForm } from './ChangePasswordForm';
import { changePassword, loadUser } from './state/actions';
function mapStateToProps(state) {
    const userState = state.user;
    const { isUpdating, user } = userState;
    return {
        isUpdating,
        user,
    };
}
const mapDispatchToProps = {
    loadUser,
    changePassword,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export function ChangePasswordPage({ loadUser, isUpdating, user, changePassword }) {
    useMount(() => loadUser());
    return (React.createElement(Page, { navId: "profile/password" },
        React.createElement(Page.Contents, { isLoading: !Boolean(user) }, user ? (React.createElement(React.Fragment, null,
            React.createElement(ChangePasswordForm, { user: user, onChangePassword: changePassword, isSaving: isUpdating }))) : null)));
}
export default connector(ChangePasswordPage);
//# sourceMappingURL=ChangePasswordPage.js.map