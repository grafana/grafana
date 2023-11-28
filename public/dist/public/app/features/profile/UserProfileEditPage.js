import React from 'react';
import { connect } from 'react-redux';
import { useMount } from 'react-use';
import { VerticalGroup } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';
import UserOrganizations from './UserOrganizations';
import UserProfileEditForm from './UserProfileEditForm';
import UserSessions from './UserSessions';
import { UserTeams } from './UserTeams';
import { changeUserOrg, initUserProfilePage, revokeUserSession, updateUserProfile } from './state/actions';
function mapStateToProps(state) {
    const userState = state.user;
    const { user, teams, orgs, sessions, teamsAreLoading, orgsAreLoading, sessionsAreLoading, isUpdating } = userState;
    return {
        orgsAreLoading,
        sessionsAreLoading,
        teamsAreLoading,
        orgs,
        sessions,
        teams,
        isUpdating,
        user,
    };
}
const mapDispatchToProps = {
    initUserProfilePage,
    revokeUserSession,
    changeUserOrg,
    updateUserProfile,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export function UserProfileEditPage({ orgsAreLoading, sessionsAreLoading, teamsAreLoading, initUserProfilePage, orgs, sessions, teams, isUpdating, user, revokeUserSession, changeUserOrg, updateUserProfile, }) {
    useMount(() => initUserProfilePage());
    return (React.createElement(Page, { navId: "profile/settings" },
        React.createElement(Page.Contents, { isLoading: !user },
            React.createElement(VerticalGroup, { spacing: "md" },
                React.createElement(UserProfileEditForm, { updateProfile: updateUserProfile, isSavingUser: isUpdating, user: user }),
                React.createElement(SharedPreferences, { resourceUri: "user", preferenceType: "user" }),
                React.createElement(UserTeams, { isLoading: teamsAreLoading, teams: teams }),
                React.createElement(UserOrganizations, { isLoading: orgsAreLoading, setUserOrg: changeUserOrg, orgs: orgs, user: user }),
                React.createElement(UserSessions, { isLoading: sessionsAreLoading, revokeUserSession: revokeUserSession, sessions: sessions })))));
}
export default connector(UserProfileEditPage);
//# sourceMappingURL=UserProfileEditPage.js.map