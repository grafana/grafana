import { __awaiter } from "tslib";
import { createAction, createAsyncThunk } from '@reduxjs/toolkit';
import { from, forkJoin, timeout, lastValueFrom, catchError, throwError } from 'rxjs';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';
import { invalidatePluginInCache } from '../../loader/cache';
import { getRemotePlugins, getPluginErrors, getLocalPlugins, getPluginDetails, installPlugin, uninstallPlugin, } from '../api';
import { STATE_PREFIX } from '../constants';
import { mapLocalToCatalog, mergeLocalsAndRemotes, updatePanels } from '../helpers';
// Fetches
export const fetchAll = createAsyncThunk(`${STATE_PREFIX}/fetchAll`, (_, thunkApi) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchLocal/pending` });
        thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchRemote/pending` });
        const local$ = from(getLocalPlugins());
        const remote$ = from(getRemotePlugins());
        const pluginErrors$ = from(getPluginErrors());
        forkJoin({
            local: local$,
            remote: remote$,
            pluginErrors: pluginErrors$,
        })
            .pipe(
        // Fetching the list of plugins from GCOM is slow / errors out
        timeout({
            each: 500,
            with: () => {
                remote$
                    // The request to fetch remote plugins from GCOM failed
                    .pipe(catchError((err) => {
                    thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchRemote/rejected` });
                    return throwError(() => new Error('Failed to fetch plugins from catalog (default https://grafana.com/api/plugins)'));
                }))
                    // Remote plugins loaded after a timeout, updating the store
                    .subscribe((remote) => __awaiter(void 0, void 0, void 0, function* () {
                    thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchRemote/fulfilled` });
                    if (remote.length > 0) {
                        const local = yield lastValueFrom(local$);
                        const pluginErrors = yield lastValueFrom(pluginErrors$);
                        thunkApi.dispatch(addPlugins(mergeLocalsAndRemotes(local, remote, pluginErrors)));
                    }
                }));
                return forkJoin({ local: local$, pluginErrors: pluginErrors$ });
            },
        }))
            .subscribe(({ local, remote, pluginErrors, }) => {
            thunkApi.dispatch({ type: `${STATE_PREFIX}/fetchLocal/fulfilled` });
            // Both local and remote plugins are loaded
            if (local && remote) {
                thunkApi.dispatch(addPlugins(mergeLocalsAndRemotes(local, remote, pluginErrors)));
                // Only remote plugins are loaded (remote timed out)
            }
            else if (local) {
                thunkApi.dispatch(addPlugins(mergeLocalsAndRemotes(local, [], pluginErrors)));
            }
        });
        return null;
    }
    catch (e) {
        return thunkApi.rejectWithValue('Unknown error.');
    }
}));
export const fetchAllLocal = createAsyncThunk(`${STATE_PREFIX}/fetchAllLocal`, (_, thunkApi) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const localPlugins = yield getLocalPlugins();
        return localPlugins.map((plugin) => mapLocalToCatalog(plugin));
    }
    catch (e) {
        return thunkApi.rejectWithValue('Unknown error.');
    }
}));
export const fetchRemotePlugins = createAsyncThunk(`${STATE_PREFIX}/fetchRemotePlugins`, (_, thunkApi) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield getRemotePlugins();
    }
    catch (error) {
        if (isFetchError(error)) {
            error.isHandled = true;
        }
        return thunkApi.rejectWithValue([]);
    }
}));
export const fetchDetails = createAsyncThunk(`${STATE_PREFIX}/fetchDetails`, (id, thunkApi) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const details = yield getPluginDetails(id);
        return {
            id,
            changes: { details },
        };
    }
    catch (e) {
        return thunkApi.rejectWithValue('Unknown error.');
    }
}));
export const addPlugins = createAction(`${STATE_PREFIX}/addPlugins`);
// 1. gets remote equivalents from the store (if there are any)
// 2. merges the remote equivalents with the local plugins
// 3. updates the the store with the updated CatalogPlugin objects
export const addLocalPlugins = createAction(`${STATE_PREFIX}/addLocalPlugins`);
// 1. gets local equivalents from the store (if there are any)
// 2. merges the local equivalents with the remote plugins
// 3. updates the the store with the updated CatalogPlugin objects
export const addRemotePlugins = createAction(`${STATE_PREFIX}/addLocalPlugins`);
// 1. merges the local and remote plugins
// 2. updates the store with the CatalogPlugin objects
export const addLocalAndRemotePlugins = createAction(`${STATE_PREFIX}/addLocalPlugins`);
// We are also using the install API endpoint to update the plugin
export const install = createAsyncThunk(`${STATE_PREFIX}/install`, ({ id, version, isUpdating = false }, thunkApi) => __awaiter(void 0, void 0, void 0, function* () {
    const changes = isUpdating
        ? { isInstalled: true, installedVersion: version, hasUpdate: false }
        : { isInstalled: true, installedVersion: version };
    try {
        yield installPlugin(id);
        yield updatePanels();
        if (isUpdating) {
            invalidatePluginInCache(id);
        }
        return { id, changes };
    }
    catch (e) {
        console.error(e);
        if (isFetchError(e)) {
            return thunkApi.rejectWithValue(e.data);
        }
        return thunkApi.rejectWithValue('Unknown error.');
    }
}));
export const unsetInstall = createAsyncThunk(`${STATE_PREFIX}/install`, () => __awaiter(void 0, void 0, void 0, function* () { return ({}); }));
export const uninstall = createAsyncThunk(`${STATE_PREFIX}/uninstall`, (id, thunkApi) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield uninstallPlugin(id);
        yield updatePanels();
        invalidatePluginInCache(id);
        return {
            id,
            changes: { isInstalled: false, installedVersion: undefined },
        };
    }
    catch (e) {
        console.error(e);
        return thunkApi.rejectWithValue('Unknown error.');
    }
}));
// We need this to be backwards-compatible with other parts of Grafana.
// (Originally in "public/app/features/plugins/state/actions.ts")
// TODO<remove once the "plugin_admin_enabled" feature flag is removed>
export const loadPluginDashboards = createAsyncThunk(`${STATE_PREFIX}/loadPluginDashboards`, (_, thunkApi) => __awaiter(void 0, void 0, void 0, function* () {
    const state = thunkApi.getState();
    const dataSourceType = state.dataSources.dataSource.type;
    const url = `api/plugins/${dataSourceType}/dashboards`;
    return getBackendSrv().get(url);
}));
export const panelPluginLoaded = createAction(`${STATE_PREFIX}/panelPluginLoaded`);
// We need this to be backwards-compatible with other parts of Grafana.
// (Originally in "public/app/features/plugins/state/actions.ts")
// It cannot be constructed with `createAsyncThunk()` as we need the return value on the call-site,
// and we cannot easily change the call-site to unwrap the result.
// TODO<remove once the "plugin_admin_enabled" feature flag is removed>
export const loadPanelPlugin = (id) => {
    return (dispatch, getStore) => __awaiter(void 0, void 0, void 0, function* () {
        let plugin = getStore().plugins.panels[id];
        if (!plugin) {
            plugin = yield importPanelPlugin(id);
            // second check to protect against raise condition
            if (!getStore().plugins.panels[id]) {
                dispatch(panelPluginLoaded(plugin));
            }
        }
        return plugin;
    });
};
//# sourceMappingURL=actions.js.map