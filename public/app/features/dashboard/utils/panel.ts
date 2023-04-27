import { isString as _isString } from 'lodash';

import { TimeRange, AppEvents, rangeUtil, dateMath, PanelModel as IPanelModel } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import config from 'app/core/config';
import { LS_PANEL_COPY_KEY, PANEL_BORDER } from 'app/core/constants';
import store from 'app/core/store';
import { ShareModal } from 'app/features/dashboard/components/ShareModal';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { AddLibraryPanelModal } from 'app/features/library-panels/components/AddLibraryPanelModal/AddLibraryPanelModal';
import { UnlinkModal } from 'app/features/library-panels/components/UnlinkModal/UnlinkModal';
import { cleanUpPanelState } from 'app/features/panel/state/actions';
import { dispatch } from 'app/store/store';

import { ShowConfirmModalEvent, ShowModalReactEvent } from '../../../types/events';

export const removePanel = (dashboard: DashboardModel, panel: PanelModel, ask: boolean) => {
  // confirm deletion
  if (ask !== false) {
    const text2 =
      panel.alert && !config.unifiedAlertingEnabled
        ? 'Panel includes an alert rule. removing the panel will also remove the alert rule'
        : undefined;
    const confirmText = panel.alert ? 'YES' : undefined;

    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Remove panel',
        text: 'Are you sure you want to remove this panel?',
        text2: text2,
        icon: 'trash-alt',
        confirmText: confirmText,
        yesText: 'Remove',
        onConfirm: () => removePanel(dashboard, panel, false),
      })
    );
    return;
  }

  dashboard.removePanel(panel);
  dispatch(cleanUpPanelState(panel.key));
};

export const duplicatePanel = (dashboard: DashboardModel, panel: PanelModel) => {
  dashboard.duplicatePanel(panel);
};

export const copyPanel = (panel: IPanelModel) => {
  let saveModel = panel;
  if (panel instanceof PanelModel) {
    saveModel = panel.getSaveModel();
  }

  store.set(LS_PANEL_COPY_KEY, JSON.stringify(saveModel));
  appEvents.emit(AppEvents.alertSuccess, ['Panel copied. Click **Add panel** icon to paste.']);
};

export const sharePanel = (dashboard: DashboardModel, panel: PanelModel) => {
  appEvents.publish(
    new ShowModalReactEvent({
      component: ShareModal,
      props: {
        dashboard: dashboard,
        panel: panel,
      },
    })
  );
};

export const addLibraryPanel = (dashboard: DashboardModel, panel: PanelModel) => {
  appEvents.publish(
    new ShowModalReactEvent({
      component: AddLibraryPanelModal,
      props: {
        panel,
        initialFolderUid: dashboard.meta.folderUid,
        isOpen: true,
      },
    })
  );
};

export const unlinkLibraryPanel = (panel: PanelModel) => {
  appEvents.publish(
    new ShowModalReactEvent({
      component: UnlinkModal,
      props: {
        onConfirm: () => panel.unlinkLibraryPanel(),
        isOpen: true,
      },
    })
  );
};

export const refreshPanel = (panel: PanelModel) => {
  panel.refresh();
};

export const toggleLegend = (panel: PanelModel) => {
  const newOptions = { ...panel.options };
  newOptions.legend.showLegend === true
    ? (newOptions.legend.showLegend = false)
    : (newOptions.legend.showLegend = true);
  panel.updateOptions(newOptions);
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
    const timeFromInterpolated = getTemplateSrv().replace(panel.timeFrom, panel.scopedVars);
    const timeFromInfo = rangeUtil.describeTextRange(timeFromInterpolated);
    if (timeFromInfo.invalid) {
      newTimeData.timeInfo = 'invalid time override';
      return newTimeData;
    }

    if (_isString(timeRange.raw.from)) {
      const timeFromDate = dateMath.parse(timeFromInfo.from)!;
      newTimeData.timeInfo = timeFromInfo.display;
      newTimeData.timeRange = {
        from: timeFromDate,
        to: dateMath.parse(timeFromInfo.to)!,
        raw: {
          from: timeFromInfo.from,
          to: timeFromInfo.to,
        },
      };
    }
  }

  if (panel.timeShift) {
    const timeShiftInterpolated = getTemplateSrv().replace(panel.timeShift, panel.scopedVars);
    const timeShiftInfo = rangeUtil.describeTextRange(timeShiftInterpolated);
    if (timeShiftInfo.invalid) {
      newTimeData.timeInfo = 'invalid timeshift';
      return newTimeData;
    }

    const timeShift = '-' + timeShiftInterpolated;
    newTimeData.timeInfo += ' timeshift ' + timeShift;
    const from = dateMath.parseDateMath(timeShift, newTimeData.timeRange.from, false)!;
    const to = dateMath.parseDateMath(timeShift, newTimeData.timeRange.to, true)!;

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

export function calculateNewPanelGridPos(dashboard: DashboardModel): PanelModel['gridPos'] {
  // Move all panels down by the height of the "add panel" widget.
  // This is to work around an issue with react-grid-layout that can mess up the layout
  // in certain configurations. (See https://github.com/react-grid-layout/react-grid-layout/issues/1787)
  const addPanelWidgetHeight = 8;
  for (const panel of dashboard.panelIterator()) {
    panel.gridPos.y += addPanelWidgetHeight;
  }

  return { x: 0, y: 0, w: 12, h: addPanelWidgetHeight };
}
