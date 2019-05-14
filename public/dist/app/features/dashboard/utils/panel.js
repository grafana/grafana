// Store
import store from 'app/core/store';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
// Utils
import { isString as _isString } from 'lodash';
import * as rangeUtil from 'app/core/utils/rangeutil';
import * as dateMath from 'app/core/utils/datemath';
import appEvents from 'app/core/app_events';
// Services
import templateSrv from 'app/features/templating/template_srv';
// Constants
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
export var removePanel = function (dashboard, panel, ask) {
    // confirm deletion
    if (ask !== false) {
        var text2 = panel.alert ? 'Panel includes an alert rule, removing panel will also remove alert rule' : null;
        var confirmText = panel.alert ? 'YES' : null;
        appEvents.emit('confirm-modal', {
            title: 'Remove Panel',
            text: 'Are you sure you want to remove this panel?',
            text2: text2,
            icon: 'fa-trash',
            confirmText: confirmText,
            yesText: 'Remove',
            onConfirm: function () { return removePanel(dashboard, panel, false); },
        });
        return;
    }
    dashboard.removePanel(panel);
};
export var duplicatePanel = function (dashboard, panel) {
    dashboard.duplicatePanel(panel);
};
export var copyPanel = function (panel) {
    store.set(LS_PANEL_COPY_KEY, JSON.stringify(panel.getSaveModel()));
    appEvents.emit('alert-success', ['Panel copied. Open Add Panel to paste']);
};
var replacePanel = function (dashboard, newPanel, oldPanel) {
    var index = dashboard.panels.findIndex(function (panel) {
        return panel.id === oldPanel.id;
    });
    var deletedPanel = dashboard.panels.splice(index, 1);
    dashboard.events.emit('panel-removed', deletedPanel);
    newPanel = new PanelModel(newPanel);
    newPanel.id = oldPanel.id;
    dashboard.panels.splice(index, 0, newPanel);
    dashboard.sortPanelsByGridPos();
    dashboard.events.emit('panel-added', newPanel);
};
export var editPanelJson = function (dashboard, panel) {
    var model = {
        object: panel.getSaveModel(),
        updateHandler: function (newPanel, oldPanel) {
            replacePanel(dashboard, newPanel, oldPanel);
        },
        canUpdate: dashboard.meta.canEdit,
        enableCopy: true,
    };
    appEvents.emit('show-modal', {
        src: 'public/app/partials/edit_json.html',
        model: model,
    });
};
export var sharePanel = function (dashboard, panel) {
    appEvents.emit('show-modal', {
        src: 'public/app/features/dashboard/components/ShareModal/template.html',
        model: {
            dashboard: dashboard,
            panel: panel,
        },
    });
};
export var refreshPanel = function (panel) {
    panel.refresh();
};
export var toggleLegend = function (panel) {
    console.log('Toggle legend is not implemented yet');
    // We need to set panel.legend defaults first
    // panel.legend.show = !panel.legend.show;
    refreshPanel(panel);
};
export function applyPanelTimeOverrides(panel, timeRange) {
    var newTimeData = {
        timeInfo: '',
        timeRange: timeRange,
    };
    if (panel.timeFrom) {
        var timeFromInterpolated = templateSrv.replace(panel.timeFrom, panel.scopedVars);
        var timeFromInfo = rangeUtil.describeTextRange(timeFromInterpolated);
        if (timeFromInfo.invalid) {
            newTimeData.timeInfo = 'invalid time override';
            return newTimeData;
        }
        if (_isString(timeRange.raw.from)) {
            var timeFromDate = dateMath.parse(timeFromInfo.from);
            newTimeData.timeInfo = timeFromInfo.display;
            newTimeData.timeRange = {
                from: timeFromDate,
                to: dateMath.parse(timeFromInfo.to),
                raw: {
                    from: timeFromInfo.from,
                    to: timeFromInfo.to,
                },
            };
        }
    }
    if (panel.timeShift) {
        var timeShiftInterpolated = templateSrv.replace(panel.timeShift, panel.scopedVars);
        var timeShiftInfo = rangeUtil.describeTextRange(timeShiftInterpolated);
        if (timeShiftInfo.invalid) {
            newTimeData.timeInfo = 'invalid timeshift';
            return newTimeData;
        }
        var timeShift = '-' + timeShiftInterpolated;
        newTimeData.timeInfo += ' timeshift ' + timeShift;
        var from = dateMath.parseDateMath(timeShift, newTimeData.timeRange.from, false);
        var to = dateMath.parseDateMath(timeShift, newTimeData.timeRange.to, true);
        newTimeData.timeRange = {
            from: from,
            to: to,
            raw: {
                from: from,
                to: to,
            },
        };
    }
    if (panel.hideTimeOverride) {
        newTimeData.timeInfo = '';
    }
    return newTimeData;
}
export function getResolution(panel) {
    var htmlEl = document.getElementsByTagName('html')[0];
    var width = htmlEl.getBoundingClientRect().width; // https://stackoverflow.com/a/21454625
    return panel.maxDataPoints ? panel.maxDataPoints : Math.ceil(width * (panel.gridPos.w / 24));
}
var isTimeSeries = function (data) { return data && data.hasOwnProperty('datapoints'); };
var isTableData = function (data) { return data && data.hasOwnProperty('columns'); };
export var snapshotDataToPanelData = function (panel) {
    var snapshotData = panel.snapshotData;
    if (isTimeSeries(snapshotData[0])) {
        return {
            timeSeries: snapshotData,
        };
    }
    else if (isTableData(snapshotData[0])) {
        return {
            tableData: snapshotData[0],
        };
    }
    throw new Error('snapshotData is invalid:' + snapshotData.toString());
};
//# sourceMappingURL=panel.js.map