import { ShowOption, SortOrder } from './types';
export const alertListPanelMigrationHandler = (panel) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    const newOptions = {
        showOptions: (_b = (_a = panel.options.showOptions) !== null && _a !== void 0 ? _a : panel.show) !== null && _b !== void 0 ? _b : ShowOption.Current,
        maxItems: (_d = (_c = panel.options.maxItems) !== null && _c !== void 0 ? _c : panel.limit) !== null && _d !== void 0 ? _d : 10,
        sortOrder: (_f = (_e = panel.options.sortOrder) !== null && _e !== void 0 ? _e : panel.sortOrder) !== null && _f !== void 0 ? _f : SortOrder.AlphaAsc,
        dashboardAlerts: (_h = (_g = panel.options.dashboardAlerts) !== null && _g !== void 0 ? _g : panel.onlyAlertsOnDashboard) !== null && _h !== void 0 ? _h : false,
        alertName: (_k = (_j = panel.options.alertName) !== null && _j !== void 0 ? _j : panel.nameFilter) !== null && _k !== void 0 ? _k : '',
        dashboardTitle: (_m = (_l = panel.options.dashboardTitle) !== null && _l !== void 0 ? _l : panel.dashboardFilter) !== null && _m !== void 0 ? _m : '',
        folderId: (_o = panel.options.folderId) !== null && _o !== void 0 ? _o : panel.folderId,
        tags: (_q = (_p = panel.options.tags) !== null && _p !== void 0 ? _p : panel.dashboardTags) !== null && _q !== void 0 ? _q : [],
        stateFilter: (_t = (_r = panel.options.stateFilter) !== null && _r !== void 0 ? _r : (_s = panel.stateFilter) === null || _s === void 0 ? void 0 : _s.reduce((filterObj, curFilter) => (Object.assign(Object.assign({}, filterObj), { [curFilter]: true })), {})) !== null && _t !== void 0 ? _t : {},
    };
    const previousVersion = parseFloat(panel.pluginVersion || '7.4');
    if (previousVersion < 7.5) {
        const oldProps = [
            'show',
            'limit',
            'sortOrder',
            'onlyAlertsOnDashboard',
            'nameFilter',
            'dashboardFilter',
            'folderId',
            'dashboardTags',
            'stateFilter',
        ];
        oldProps.forEach((prop) => delete panel[prop]);
    }
    return newOptions;
};
//# sourceMappingURL=AlertListMigrationHandler.js.map