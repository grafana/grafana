// Store
import store from 'app/core/store';

// Models
import { DashboardModel } from 'app/features/dashboard/dashboard_model';
import { PanelModel } from 'app/features/dashboard/panel_model';
import { TimeData } from 'app/types';
import { TimeRange } from 'app/types/series';

// Utils
import { isString as _isString } from 'lodash';
import * as rangeUtil from 'app/core/utils/rangeutil';
import * as dateMath from 'app/core/utils/datemath';
import appEvents from 'app/core/app_events';
import kbn from 'app/core/utils/kbn';

// Services
import templateSrv from 'app/features/templating/template_srv';

// Constants
import { LS_PANEL_COPY_KEY } from 'app/core/constants';

export const removePanel = (dashboard: DashboardModel, panel: PanelModel, ask: boolean) => {
  // confirm deletion
  if (ask !== false) {
    const text2 = panel.alert ? 'Panel includes an alert rule, removing panel will also remove alert rule' : null;
    const confirmText = panel.alert ? 'YES' : null;

    appEvents.emit('confirm-modal', {
      title: 'Remove Panel',
      text: 'Are you sure you want to remove this panel?',
      text2: text2,
      icon: 'fa-trash',
      confirmText: confirmText,
      yesText: 'Remove',
      onConfirm: () => removePanel(dashboard, panel, false),
    });
    return;
  }
  dashboard.removePanel(panel);
};

export const duplicatePanel = (dashboard: DashboardModel, panel: PanelModel) => {
  dashboard.duplicatePanel(panel);
};

export const copyPanel = (panel: PanelModel) => {
  store.set(LS_PANEL_COPY_KEY, JSON.stringify(panel.getSaveModel()));
  appEvents.emit('alert-success', ['Panel copied. Open Add Panel to paste']);
};

const replacePanel = (dashboard: DashboardModel, newPanel: PanelModel, oldPanel: PanelModel) => {
  const index = dashboard.panels.findIndex(panel => {
    return panel.id === oldPanel.id;
  });

  const deletedPanel = dashboard.panels.splice(index, 1);
  dashboard.events.emit('panel-removed', deletedPanel);

  newPanel = new PanelModel(newPanel);
  newPanel.id = oldPanel.id;

  dashboard.panels.splice(index, 0, newPanel);
  dashboard.sortPanelsByGridPos();
  dashboard.events.emit('panel-added', newPanel);
};

export const editPanelJson = (dashboard: DashboardModel, panel: PanelModel) => {
  const model = {
    object: panel.getSaveModel(),
    updateHandler: (newPanel: PanelModel, oldPanel: PanelModel) => {
      replacePanel(dashboard, newPanel, oldPanel);
    },
    enableCopy: true,
  };

  appEvents.emit('show-modal', {
    src: 'public/app/partials/edit_json.html',
    model: model,
  });
};

export const sharePanel = (dashboard: DashboardModel, panel: PanelModel) => {
  appEvents.emit('show-modal', {
    src: 'public/app/features/dashboard/partials/shareModal.html',
    model: {
      dashboard: dashboard,
      panel: panel,
    },
  });
};

export const refreshPanel = (panel: PanelModel) => {
  panel.refresh();
};

export const toggleLegend = (panel: PanelModel) => {
  console.log('Toggle legend is not implemented yet');
  // We need to set panel.legend defaults first
  // panel.legend.show = !panel.legend.show;
  refreshPanel(panel);
};

export const applyPanelTimeOverrides = (panel: PanelModel, timeData: TimeData): TimeData => {
  const { timeRange } = timeData;
  const newTimeData = { ...timeData };

  if (panel.timeFrom) {
    const timeFromInterpolated = templateSrv.replace(panel.timeFrom, panel.scopedVars);
    const timeFromInfo = rangeUtil.describeTextRange(timeFromInterpolated);
    if (timeFromInfo.invalid) {
      newTimeData.timeInfo = 'invalid time override';
      return newTimeData;
    }

    if (_isString(timeRange.raw.from)) {
      const timeFromDate = dateMath.parse(timeFromInfo.from);
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
    const timeShiftInterpolated = templateSrv.replace(panel.timeShift, panel.scopedVars);
    const timeShiftInfo = rangeUtil.describeTextRange(timeShiftInterpolated);
    if (timeShiftInfo.invalid) {
      newTimeData.timeInfo = 'invalid timeshift';
      return newTimeData;
    }

    const timeShift = '-' + timeShiftInterpolated;
    newTimeData.timeInfo = ' timeshift ' + timeShift;
    newTimeData.timeRange = {
      from: dateMath.parseDateMath(timeShift, timeRange.from, false),
      to: dateMath.parseDateMath(timeShift, timeRange.to, true),
      raw: {
        from: timeRange.from,
        to: timeRange.to,
      },
    };
  }

  if (panel.hideTimeOverride) {
    newTimeData.timeInfo = '';
  }

  return newTimeData;
};

export const getResolution = (panel: PanelModel): number => {
  const htmlEl = document.getElementsByTagName('html')[0];
  const width = htmlEl.getBoundingClientRect().width; // https://stackoverflow.com/a/21454625

  return panel.maxDataPoints ? panel.maxDataPoints : Math.ceil(width * (panel.gridPos.w / 24));
};

export const calculateInterval = (
  panel: PanelModel,
  datasource,
  timeRange: TimeRange,
  resolution: number
): { interval: string; intervalMs: number } => {
  let intervalOverride = panel.interval;

  // if no panel interval check datasource
  if (intervalOverride) {
    intervalOverride = templateSrv.replace(intervalOverride, panel.scopedVars);
  } else if (datasource && datasource.interval) {
    intervalOverride = datasource.interval;
  }

  const res = kbn.calculateInterval(timeRange, resolution, intervalOverride);

  return {
    interval: res.interval,
    intervalMs: res.intervalMs,
  };
};
