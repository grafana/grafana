'use strict';

var _;

var dashboard = JSON.parse(decodeURIComponent(ARGS.dashboard));
if (!dashboard.version || !dashboard.schemaVersion || !dashboard.rows || dashboard.rows.length === 0) {
    console.log('Please set version/schemaVersion/rows');
    return {};
}

var isValidDashboard = _.every(dashboard.rows, function (r) {
    return r.panels.length === 0 ||
        _.every(r.panels, function (p) {
            return p.type !== '' &&
                p.datasource != '' &&
                p.span &&
                p.targets.length != 0;
        });
});
if (!isValidDashboard) {
    console.log('Please provide valid dashboard');
    return {};
}

return dashboard;
