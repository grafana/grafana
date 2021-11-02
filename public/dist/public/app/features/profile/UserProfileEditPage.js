import React from 'react';
import { connect } from 'react-redux';
import { useMount } from 'react-use';
import { VerticalGroup } from '@grafana/ui';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { changeUserOrg, initUserProfilePage, revokeUserSession, updateUserProfile } from './state/actions';
import UserProfileEditForm from './UserProfileEditForm';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';
import { UserTeams } from './UserTeams';
import UserOrganizations from './UserOrganizations';
import UserSessions from './UserSessions';
function mapStateToProps(state) {
    var userState = state.user;
    var user = userState.user, teams = userState.teams, orgs = userState.orgs, sessions = userState.sessions, teamsAreLoading = userState.teamsAreLoading, orgsAreLoading = userState.orgsAreLoading, sessionsAreLoading = userState.sessionsAreLoading, isUpdating = userState.isUpdating;
    return {
        navModel: getNavModel(state.navIndex, 'profile-settings'),
        orgsAreLoading: orgsAreLoading,
        sessionsAreLoading: sessionsAreLoading,
        teamsAreLoading: teamsAreLoading,
        orgs: orgs,
        sessions: sessions,
        teams: teams,
        isUpdating: isUpdating,
        user: user,
    };
}
var mapDispatchToProps = {
    initUserProfilePage: initUserProfilePage,
    revokeUserSession: revokeUserSession,
    changeUserOrg: changeUserOrg,
    updateUserProfile: updateUserProfile,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
export function UserProfileEditPage(_a) {
    var navModel = _a.navModel, orgsAreLoading = _a.orgsAreLoading, sessionsAreLoading = _a.sessionsAreLoading, teamsAreLoading = _a.teamsAreLoading, initUserProfilePage = _a.initUserProfilePage, orgs = _a.orgs, sessions = _a.sessions, teams = _a.teams, isUpdating = _a.isUpdating, user = _a.user, revokeUserSession = _a.revokeUserSession, changeUserOrg = _a.changeUserOrg, updateUserProfile = _a.updateUserProfile;
    useMount(function () { return initUserProfilePage(); });
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, { isLoading: !user },
            React.createElement(VerticalGroup, { spacing: "md" },
                React.createElement(UserProfileEditForm, { updateProfile: updateUserProfile, isSavingUser: isUpdating, user: user }),
                React.createElement(SharedPreferences, { resourceUri: "user" }),
                React.createElement(UserTeams, { isLoading: teamsAreLoading, teams: teams }),
                React.createElement(UserOrganizations, { isLoading: orgsAreLoading, setUserOrg: changeUserOrg, orgs: orgs, user: user }),
                React.createElement(UserSessions, { isLoading: sessionsAreLoading, revokeUserSession: revokeUserSession, sessions: sessions })))));
}
export default connector(UserProfileEditPage);
//# sourceMappingURL=UserProfileEditPage.js.map