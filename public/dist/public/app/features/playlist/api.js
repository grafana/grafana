import { __awaiter } from "tslib";
import { lastValueFrom } from 'rxjs';
import { DataFrameView } from '@grafana/data';
import { getBackendSrv, config } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { getGrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';
import { dispatch } from 'app/store/store';
import { getGrafanaSearcher } from '../search/service';
class LegacyAPI {
    getAllPlaylist() {
        return __awaiter(this, void 0, void 0, function* () {
            return getBackendSrv().get('/api/playlists/');
        });
    }
    getPlaylist(uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const p = yield getBackendSrv().get(`/api/playlists/${uid}`);
            yield migrateInternalIDs(p);
            return p;
        });
    }
    createPlaylist(playlist) {
        return __awaiter(this, void 0, void 0, function* () {
            yield withErrorHandling(() => getBackendSrv().post('/api/playlists', playlist));
        });
    }
    updatePlaylist(playlist) {
        return __awaiter(this, void 0, void 0, function* () {
            yield withErrorHandling(() => getBackendSrv().put(`/api/playlists/${playlist.uid}`, playlist));
        });
    }
    deletePlaylist(uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield withErrorHandling(() => getBackendSrv().delete(`/api/playlists/${uid}`), 'Playlist deleted');
        });
    }
}
class K8sAPI {
    constructor() {
        const ns = contextSrv.user.orgId === 1 ? 'default' : `org-${contextSrv.user.orgId}`;
        this.url = `/apis/playlist.x.grafana.com/v0alpha1/namespaces/${ns}/playlists`;
        // When undefined, this will use k8s for all CRUD features
        // if (!config.featureToggles.grafanaAPIServerWithExperimentalAPIs) {
        this.legacy = new LegacyAPI();
    }
    getAllPlaylist() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield getBackendSrv().get(this.url);
            return result.playlists.map(k8sResourceAsPlaylist);
        });
    }
    getPlaylist(uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const r = yield getBackendSrv().get(this.url + '/' + uid);
            const p = k8sResourceAsPlaylist(r);
            yield migrateInternalIDs(p);
            return p;
        });
    }
    createPlaylist(playlist) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.legacy) {
                return this.legacy.createPlaylist(playlist);
            }
            yield withErrorHandling(() => getBackendSrv().post(this.url, {
                apiVersion: 'playlists.grafana.com/v0alpha1',
                kind: 'Playlist',
                metadata: {
                    name: playlist.uid,
                },
                spec: playlist,
            }));
        });
    }
    updatePlaylist(playlist) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.legacy) {
                return this.legacy.updatePlaylist(playlist);
            }
            yield withErrorHandling(() => getBackendSrv().put(`${this.url}/${playlist.uid}`, {
                apiVersion: 'playlists.grafana.com/v0alpha1',
                kind: 'Playlist',
                metadata: {
                    name: playlist.uid,
                },
                spec: Object.assign(Object.assign({}, playlist), { title: playlist.name }),
            }));
        });
    }
    deletePlaylist(uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.legacy) {
                return this.legacy.deletePlaylist(uid);
            }
            yield withErrorHandling(() => getBackendSrv().delete(`${this.url}/${uid}`), 'Playlist deleted');
        });
    }
}
// This converts a saved k8s resource into a playlist object
// the main difference is that k8s uses metdata.name as the uid
// to avoid future confusion, the display name is now called "title"
function k8sResourceAsPlaylist(r) {
    const { spec, metadata } = r;
    return {
        uid: metadata.name,
        name: spec.title,
        interval: spec.interval,
        items: spec.items,
    };
}
/** @deprecated -- this migrates playlists saved with internal ids to uid  */
function migrateInternalIDs(playlist) {
    return __awaiter(this, void 0, void 0, function* () {
        if (playlist === null || playlist === void 0 ? void 0 : playlist.items) {
            for (const item of playlist.items) {
                if (item.type === 'dashboard_by_id') {
                    item.type = 'dashboard_by_uid';
                    const uids = yield getBackendSrv().get(`/api/dashboards/ids/${item.value}`);
                    if (uids === null || uids === void 0 ? void 0 : uids.length) {
                        item.value = uids[0];
                    }
                }
            }
        }
    });
}
function withErrorHandling(apiCall, message = 'Playlist saved') {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield apiCall();
            dispatch(notifyApp(createSuccessNotification(message)));
        }
        catch (e) {
            if (e instanceof Error) {
                dispatch(notifyApp(createErrorNotification('Unable to save playlist', e)));
            }
        }
    });
}
/** Returns a copy with the dashboards loaded */
export function loadDashboards(items) {
    return __awaiter(this, void 0, void 0, function* () {
        let idx = 0;
        if (!(items === null || items === void 0 ? void 0 : items.length)) {
            return [];
        }
        const targets = [];
        for (const item of items) {
            const query = {
                query: '*',
                kind: ['dashboard'],
                limit: 1000,
            };
            switch (item.type) {
                case 'dashboard_by_id':
                    throw new Error('invalid item (with id)');
                case 'dashboard_by_uid':
                    query.uid = [item.value];
                    break;
                case 'dashboard_by_tag':
                    query.tags = [item.value];
                    break;
            }
            targets.push({
                refId: `${idx++}`,
                queryType: GrafanaQueryType.Search,
                search: query,
            });
        }
        // The SQL based store can only execute individual queries
        if (!config.featureToggles.panelTitleSearch) {
            const searcher = getGrafanaSearcher();
            const res = [];
            for (let i = 0; i < targets.length; i++) {
                const view = (yield searcher.search(targets[i].search)).view;
                res.push(Object.assign(Object.assign({}, items[i]), { dashboards: view.map((v) => (Object.assign({}, v))) }));
            }
            return res;
        }
        // The bluge backend can execute multiple queries in a single request
        const ds = yield getGrafanaDatasource();
        // eslint-disable-next-line
        const rsp = yield lastValueFrom(ds.query({ targets }));
        if (rsp.data.length !== items.length) {
            throw new Error('unexpected result size');
        }
        return items.map((item, idx) => {
            const view = new DataFrameView(rsp.data[idx]);
            return Object.assign(Object.assign({}, item), { dashboards: view.map((v) => (Object.assign({}, v))) });
        });
    });
}
export function getDefaultPlaylist() {
    return { items: [], interval: '5m', name: '', uid: '' };
}
export function searchPlaylists(playlists, query) {
    if (!(query === null || query === void 0 ? void 0 : query.length)) {
        return playlists;
    }
    query = query.toLowerCase();
    return playlists.filter((v) => v.name.toLowerCase().includes(query));
}
export function getPlaylistAPI() {
    return config.featureToggles.kubernetesPlaylists ? new K8sAPI() : new LegacyAPI();
}
//# sourceMappingURL=api.js.map