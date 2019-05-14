import moment from 'moment';
export function getQueryOptions(options) {
    var raw = { from: 'now', to: 'now-1h' };
    var range = { from: moment(), to: moment(), raw: raw };
    var defaults = {
        range: range,
        rangeRaw: raw,
        targets: [],
        scopedVars: {},
        timezone: 'browser',
        panelId: 1,
        dashboardId: 1,
        interval: '60s',
        intervalMs: 60000,
        maxDataPoints: 500,
    };
    Object.assign(defaults, options);
    return defaults;
}
//# sourceMappingURL=getQueryOptions.js.map