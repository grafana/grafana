// Store
import store from 'app/core/store';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { AppEvents, rangeUtil, dateMath } from '@grafana/data';
// Utils
import { isString as _isString } from 'lodash';
import appEvents from 'app/core/app_events';
import config from 'app/core/config';
// Services
import { getTemplateSrv } from '@grafana/runtime';
// Constants
import { LS_PANEL_COPY_KEY, PANEL_BORDER } from 'app/core/constants';
import { ShareModal } from 'app/features/dashboard/components/ShareModal';
import { ShowConfirmModalEvent, ShowModalReactEvent } from '../../../types/events';
import { AddLibraryPanelModal } from 'app/features/library-panels/components/AddLibraryPanelModal/AddLibraryPanelModal';
import { UnlinkModal } from 'app/features/library-panels/components/UnlinkModal/UnlinkModal';
export var removePanel = function (dashboard, panel, ask) {
    // confirm deletion
    if (ask !== false) {
        var text2 = panel.alert && !config.unifiedAlertingEnabled
            ? 'Panel includes an alert rule. removing the panel will also remove the alert rule'
            : undefined;
        var confirmText = panel.alert ? 'YES' : undefined;
        appEvents.publish(new ShowConfirmModalEvent({
            title: 'Remove panel',
            text: 'Are you sure you want to remove this panel?',
            text2: text2,
            icon: 'trash-alt',
            confirmText: confirmText,
            yesText: 'Remove',
            onConfirm: function () { return removePanel(dashboard, panel, false); },
        }));
        return;
    }
    dashboard.removePanel(panel);
};
export var duplicatePanel = function (dashboard, panel) {
    dashboard.duplicatePanel(panel);
};
export var copyPanel = function (panel) {
    var saveModel = panel;
    if (panel instanceof PanelModel) {
        saveModel = panel.getSaveModel();
    }
    store.set(LS_PANEL_COPY_KEY, JSON.stringify(saveModel));
    appEvents.emit(AppEvents.alertSuccess, ['Panel copied. Click **Add panel** icon to paste.']);
};
export var sharePanel = function (dashboard, panel) {
    appEvents.publish(new ShowModalReactEvent({
        component: ShareModal,
        props: {
            dashboard: dashboard,
            panel: panel,
        },
    }));
};
export var addLibraryPanel = function (dashboard, panel) {
    appEvents.publish(new ShowModalReactEvent({
        component: AddLibraryPanelModal,
        props: {
            panel: panel,
            initialFolderId: dashboard.meta.folderId,
            isOpen: true,
        },
    }));
};
export var unlinkLibraryPanel = function (panel) {
    appEvents.publish(new ShowModalReactEvent({
        component: UnlinkModal,
        props: {
            onConfirm: function () {
                delete panel.libraryPanel;
                panel.render();
            },
            isOpen: true,
        },
    }));
};
export var refreshPanel = function (panel) {
    panel.refresh();
};
export var toggleLegend = function (panel) {
    console.warn('Toggle legend is not implemented yet');
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
        var timeFromInterpolated = getTemplateSrv().replace(panel.timeFrom, panel.scopedVars);
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
        var timeShiftInterpolated = getTemplateSrv().replace(panel.timeShift, panel.scopedVars);
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
export function calculateInnerPanelHeight(panel, containerHeight) {
    var chromePadding = panel.plugin && panel.plugin.noPadding ? 0 : config.theme.panelPadding * 2;
    var headerHeight = panel.hasTitle() ? config.theme.panelHeaderHeight : 0;
    return containerHeight - headerHeight - chromePadding - PANEL_BORDER;
}
//# sourceMappingURL=panel.js.map