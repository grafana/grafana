import { __awaiter } from "tslib";
import { debounce } from 'lodash';
import { getBackendSrv } from '@grafana/runtime';
import { updateNavIndex } from 'app/core/actions';
import { contextSrv } from 'app/core/core';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { AccessControlAction } from 'app/types';
import { buildNavModel } from './navModel';
import { teamGroupsLoaded, queryChanged, pageChanged, teamLoaded, teamMembersLoaded, teamsLoaded, sortChanged, } from './reducers';
export function loadTeams(initial = false) {
    return (dispatch, getState) => __awaiter(this, void 0, void 0, function* () {
        const { query, page, perPage, sort } = getState().teams;
        // Early return if the user cannot list teams
        if (!contextSrv.hasPermission(AccessControlAction.ActionTeamsRead)) {
            dispatch(teamsLoaded({ teams: [], totalCount: 0, page: 1, perPage, noTeams: true }));
            return;
        }
        const response = yield getBackendSrv().get('/api/teams/search', accessControlQueryParam({ query, page, perpage: perPage, sort }));
        // We only want to check if there is no teams on the initial request.
        // A query that returns no teams should not render the empty list banner.
        let noTeams = false;
        if (initial) {
            noTeams = response.teams.length === 0;
        }
        dispatch(teamsLoaded(Object.assign({ noTeams }, response)));
    });
}
const loadTeamsWithDebounce = debounce((dispatch) => dispatch(loadTeams()), 500);
export function loadTeam(id) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const response = yield getBackendSrv().get(`/api/teams/${id}`, accessControlQueryParam());
        dispatch(teamLoaded(response));
        dispatch(updateNavIndex(buildNavModel(response)));
    });
}
export function deleteTeam(id) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().delete(`/api/teams/${id}`);
        // Update users permissions in case they lost teams.read with the deletion
        yield contextSrv.fetchUserPermissions();
        dispatch(loadTeams());
    });
}
export function changeQuery(query) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(queryChanged(query));
        loadTeamsWithDebounce(dispatch);
    });
}
export function changePage(page) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(pageChanged(page));
        dispatch(loadTeams());
    });
}
export function changeSort({ sortBy }) {
    const sort = sortBy.length ? `${sortBy[0].id}-${sortBy[0].desc ? 'desc' : 'asc'}` : undefined;
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(sortChanged(sort));
        dispatch(loadTeams());
    });
}
export function loadTeamMembers() {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const team = getStore().team.team;
        const response = yield getBackendSrv().get(`/api/teams/${team.id}/members`);
        dispatch(teamMembersLoaded(response));
    });
}
export function addTeamMember(id) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const team = getStore().team.team;
        yield getBackendSrv().post(`/api/teams/${team.id}/members`, { userId: id });
        dispatch(loadTeamMembers());
    });
}
export function removeTeamMember(id) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const team = getStore().team.team;
        yield getBackendSrv().delete(`/api/teams/${team.id}/members/${id}`);
        dispatch(loadTeamMembers());
    });
}
export function updateTeam(name, email) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const team = getStore().team.team;
        yield getBackendSrv().put(`/api/teams/${team.id}`, { name, email });
        dispatch(loadTeam(team.id));
    });
}
export function loadTeamGroups() {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const team = getStore().team.team;
        const response = yield getBackendSrv().get(`/api/teams/${team.id}/groups`);
        dispatch(teamGroupsLoaded(response));
    });
}
export function addTeamGroup(groupId) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const team = getStore().team.team;
        yield getBackendSrv().post(`/api/teams/${team.id}/groups`, { groupId: groupId });
        dispatch(loadTeamGroups());
    });
}
export function removeTeamGroup(groupId) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const team = getStore().team.team;
        // need to use query parameter due to escaped characters in the request
        yield getBackendSrv().delete(`/api/teams/${team.id}/groups?groupId=${encodeURIComponent(groupId)}`);
        dispatch(loadTeamGroups());
    });
}
export function updateTeamMember(member) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().put(`/api/teams/${member.teamId}/members/${member.userId}`, {
            permission: member.permission,
        });
        dispatch(loadTeamMembers());
    });
}
//# sourceMappingURL=actions.js.map