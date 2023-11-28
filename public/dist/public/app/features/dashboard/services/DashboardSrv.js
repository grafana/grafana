import { lastValueFrom } from 'rxjs';
import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';
import { t } from 'app/core/internationalization';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { saveDashboard } from 'app/features/manage-dashboards/state/actions';
import { RemovePanelEvent } from '../../../types/events';
import { DashboardModel } from '../state/DashboardModel';
import { removePanel } from '../utils/panel';
export class DashboardSrv {
    constructor() {
        this.onRemovePanel = (panelId) => {
            const dashboard = this.getCurrent();
            if (dashboard) {
                removePanel(dashboard, dashboard.getPanelById(panelId), true);
            }
        };
        appEvents.subscribe(RemovePanelEvent, (e) => this.onRemovePanel(e.payload));
    }
    create(dashboard, meta) {
        return new DashboardModel(dashboard, meta);
    }
    setCurrent(dashboard) {
        this.dashboard = dashboard;
    }
    getCurrent() {
        return this.dashboard;
    }
    saveJSONDashboard(json) {
        var _a;
        const parsedJson = JSON.parse(json);
        return saveDashboard({
            dashboard: parsedJson,
            folderUid: ((_a = this.dashboard) === null || _a === void 0 ? void 0 : _a.meta.folderUid) || parsedJson.folderUid,
        });
    }
    saveDashboard(data, requestOptions) {
        return lastValueFrom(getBackendSrv().fetch(Object.assign({ url: '/api/dashboards/db/', method: 'POST', data: Object.assign(Object.assign({}, data), { dashboard: data.dashboard.getSaveModelClone() }) }, requestOptions)));
    }
    starDashboard(dashboardUid, isStarred) {
        const backendSrv = getBackendSrv();
        const request = {
            showSuccessAlert: false,
            url: '/api/user/stars/dashboard/uid/' + dashboardUid,
            method: isStarred ? 'DELETE' : 'POST',
        };
        return backendSrv.request(request).then(() => {
            var _a;
            const newIsStarred = !isStarred;
            if (((_a = this.dashboard) === null || _a === void 0 ? void 0 : _a.uid) === dashboardUid) {
                this.dashboard.meta.isStarred = newIsStarred;
            }
            const message = newIsStarred
                ? t('notifications.starred-dashboard', 'Dashboard starred')
                : t('notifications.unstarred-dashboard', 'Dashboard unstarred');
            appEvents.emit(AppEvents.alertSuccess, [message]);
            return newIsStarred;
        });
    }
}
//
// Code below is to export the service to React components
//
let singletonInstance;
export function setDashboardSrv(instance) {
    singletonInstance = instance;
}
export function getDashboardSrv() {
    if (!singletonInstance) {
        singletonInstance = new DashboardSrv();
    }
    return singletonInstance;
}
//# sourceMappingURL=DashboardSrv.js.map