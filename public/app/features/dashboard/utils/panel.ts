// Store
import store from 'app/core/store';

// Models
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { TimeRange, AppEvents } from '@grafana/data';

// Utils
import { isString as _isString } from 'lodash';
import { rangeUtil } from '@grafana/data';
import { dateMath } from '@grafana/data';
import appEvents from 'app/core/app_events';
import config from 'app/core/config';

// Services
import templateSrv from 'app/features/templating/template_srv';

// Constants
import { LS_PANEL_COPY_KEY, PANEL_BORDER } from 'app/core/constants';
import { CoreEvents } from 'app/types';

import { ShareModal } from 'app/features/dashboard/components/ShareModal';

export const removePanel = (dashboard: DashboardModel, panel: PanelModel, ask: boolean) => {
  // confirm deletion
  if (ask !== false) {
    const text2 = panel.alert ? 'Panel includes an alert rule, removing panel will also remove alert rule' : null;
    const confirmText = panel.alert ? 'YES' : null;

    appEvents.emit(CoreEvents.showConfirmModal, {
      title: 'Remove Panel',
      text: 'Are you sure you want to remove this panel?',
      text2: text2,
      icon: 'trash-alt',
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
  appEvents.emit(AppEvents.alertSuccess, ['Panel copied. Open Add Panel to paste']);
};

export const sharePanel = (dashboard: DashboardModel, panel: PanelModel) => {
  appEvents.emit(CoreEvents.showModalReact, {
    component: ShareModal,
    props: {
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

export interface TimeOverrideResult {
  timeRange: TimeRange;
  timeInfo: string;
}

export function applyPanelTimeOverrides(panel: PanelModel, timeRange: TimeRange): TimeOverrideResult {
  const newTimeData = {
    timeInfo: '',
    timeRange: timeRange,
  };

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
    newTimeData.timeInfo += ' timeshift ' + timeShift;
    const from = dateMath.parseDateMath(timeShift, newTimeData.timeRange.from, false);
    const to = dateMath.parseDateMath(timeShift, newTimeData.timeRange.to, true);

    newTimeData.timeRange = {
      from,
      to,
      raw: {
        from,
        to,
      },
    };
  }

  if (panel.hideTimeOverride) {
    newTimeData.timeInfo = '';
  }

  return newTimeData;
}

export function getResolution(panel: PanelModel): number {
  const htmlEl = document.getElementsByTagName('html')[0];
  const width = htmlEl.getBoundingClientRect().width; // https://stackoverflow.com/a/21454625

  return panel.maxDataPoints ? panel.maxDataPoints : Math.ceil(width * (panel.gridPos.w / 24));
}

export function calculateInnerPanelHeight(panel: PanelModel, containerHeight: number): number {
  const chromePadding = panel.plugin && panel.plugin.noPadding ? 0 : config.theme.panelPadding * 2;
  const headerHeight = panel.hasTitle() ? config.theme.panelHeaderHeight : 0;
  return containerHeight - headerHeight - chromePadding - PANEL_BORDER;
}
