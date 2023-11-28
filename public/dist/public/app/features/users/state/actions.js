import { __awaiter } from "tslib";
import { debounce } from 'lodash';
import { getBackendSrv } from '@grafana/runtime';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { usersLoaded, pageChanged, usersFetchBegin, usersFetchEnd, searchQueryChanged, sortChanged } from './reducers';
export function loadUsers() {
    return (dispatch, getState) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { perPage, page, searchQuery, sort } = getState().users;
            const users = yield getBackendSrv().get(`/api/org/users/search`, accessControlQueryParam({ perpage: perPage, page, query: searchQuery, sort }));
            dispatch(usersLoaded(users));
        }
        catch (error) {
            usersFetchEnd();
        }
    });
}
const fetchUsersWithDebounce = debounce((dispatch) => dispatch(loadUsers()), 300);
export function updateUser(user) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().patch(`/api/org/users/${user.userId}`, { role: user.role });
        dispatch(loadUsers());
    });
}
export function removeUser(userId) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().delete(`/api/org/users/${userId}`);
        dispatch(loadUsers());
    });
}
export function changePage(page) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(usersFetchBegin());
        dispatch(pageChanged(page));
        dispatch(loadUsers());
    });
}
export function changeSort({ sortBy }) {
    const sort = sortBy.length ? `${sortBy[0].id}-${sortBy[0].desc ? 'desc' : 'asc'}` : undefined;
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(usersFetchBegin());
        dispatch(sortChanged(sort));
        dispatch(loadUsers());
    });
}
export function changeSearchQuery(query) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(usersFetchBegin());
        dispatch(searchQueryChanged(query));
        fetchUsersWithDebounce(dispatch);
    });
}
//# sourceMappingURL=actions.js.map