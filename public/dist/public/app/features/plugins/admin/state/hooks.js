import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setDisplayMode } from './reducer';
import { fetchAll, fetchDetails, fetchRemotePlugins, install, uninstall } from './actions';
import { find, selectAll, selectById, selectIsRequestPending, selectRequestError, selectIsRequestNotFetched, selectDisplayMode, } from './selectors';
import { sortPlugins, Sorters } from '../helpers';
export var useGetAllWithFilters = function (_a) {
    var _b = _a.query, query = _b === void 0 ? '' : _b, _c = _a.filterBy, filterBy = _c === void 0 ? 'installed' : _c, _d = _a.filterByType, filterByType = _d === void 0 ? 'all' : _d, _e = _a.sortBy, sortBy = _e === void 0 ? Sorters.nameAsc : _e;
    useFetchAll();
    var filtered = useSelector(find(query, filterBy, filterByType));
    var _f = useFetchStatus(), isLoading = _f.isLoading, error = _f.error;
    var sortedAndFiltered = sortPlugins(filtered, sortBy);
    return {
        isLoading: isLoading,
        error: error,
        plugins: sortedAndFiltered,
    };
};
export var useGetAll = function () {
    useFetchAll();
    return useSelector(selectAll);
};
export var useGetSingle = function (id) {
    useFetchAll();
    useFetchDetails(id);
    return useSelector(function (state) { return selectById(state, id); });
};
export var useInstall = function () {
    var dispatch = useDispatch();
    return function (id, version, isUpdating) { return dispatch(install({ id: id, version: version, isUpdating: isUpdating })); };
};
export var useUninstall = function () {
    var dispatch = useDispatch();
    return function (id) { return dispatch(uninstall(id)); };
};
export var useIsRemotePluginsAvailable = function () {
    var error = useSelector(selectRequestError(fetchRemotePlugins.typePrefix));
    return error === null;
};
export var useFetchStatus = function () {
    var isLoading = useSelector(selectIsRequestPending(fetchAll.typePrefix));
    var error = useSelector(selectRequestError(fetchAll.typePrefix));
    return { isLoading: isLoading, error: error };
};
export var useFetchDetailsStatus = function () {
    var isLoading = useSelector(selectIsRequestPending(fetchDetails.typePrefix));
    var error = useSelector(selectRequestError(fetchDetails.typePrefix));
    return { isLoading: isLoading, error: error };
};
export var useInstallStatus = function () {
    var isInstalling = useSelector(selectIsRequestPending(install.typePrefix));
    var error = useSelector(selectRequestError(install.typePrefix));
    return { isInstalling: isInstalling, error: error };
};
export var useUninstallStatus = function () {
    var isUninstalling = useSelector(selectIsRequestPending(uninstall.typePrefix));
    var error = useSelector(selectRequestError(uninstall.typePrefix));
    return { isUninstalling: isUninstalling, error: error };
};
// Only fetches in case they were not fetched yet
export var useFetchAll = function () {
    var dispatch = useDispatch();
    var isNotFetched = useSelector(selectIsRequestNotFetched(fetchAll.typePrefix));
    useEffect(function () {
        isNotFetched && dispatch(fetchAll());
    }, []); // eslint-disable-line
};
export var useFetchDetails = function (id) {
    var dispatch = useDispatch();
    var plugin = useSelector(function (state) { return selectById(state, id); });
    var isNotFetching = !useSelector(selectIsRequestPending(fetchDetails.typePrefix));
    var shouldFetch = isNotFetching && plugin && !plugin.details;
    useEffect(function () {
        shouldFetch && dispatch(fetchDetails(id));
    }, [plugin]); // eslint-disable-line
};
export var useDisplayMode = function () {
    var dispatch = useDispatch();
    var displayMode = useSelector(selectDisplayMode);
    return {
        displayMode: displayMode,
        setDisplayMode: function (v) { return dispatch(setDisplayMode(v)); },
    };
};
//# sourceMappingURL=hooks.js.map