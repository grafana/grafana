import keyBy from 'lodash/keyBy';

// Store
import store from 'app/core/store';

// Models
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { TimeRange } from '@grafana/data';

// Utils
import { isString as _isString } from 'lodash';
import { rangeUtil } from '@grafana/data';
import { dateMath } from '@grafana/data';
import appEvents from 'app/core/app_events';
import config from 'app/core/config';

// Services
import templateSrv from 'app/features/templating/template_srv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

// Constants
import { LS_PANEL_COPY_KEY, PANEL_BORDER } from 'app/core/constants';
import { DataQuery, DataSourceSelectItem } from '@grafana/ui';

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
    canUpdate: dashboard.meta.canEdit,
    enableCopy: true,
  };

  appEvents.emit('show-modal', {
    src: 'public/app/partials/edit_json.html',
    model: model,
  });
};

export const sharePanel = (dashboard: DashboardModel, panel: PanelModel) => {
  appEvents.emit('show-modal', {
    src: 'public/app/features/dashboard/components/ShareModal/template.html',
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
  return (
    containerHeight -
    (panel.hasTitle() ? config.theme.panelHeaderHeight : 0) -
    config.theme.panelPadding * 2 -
    PANEL_BORDER
  );
}

export function mergeExploreQueries(panel: PanelModel, fromExplore: boolean, queryRowCount: number): DataQuery[] {
  if (!fromExplore) {
    return panel.targets;
  }

  const datasources: DataSourceSelectItem[] = getDatasourceSrv().getMetricSources();
  const datasourceType = datasources.filter(datasource => datasource.value === panel.datasource)[0].meta.id;
  const exploreQueries: ReadonlyArray<DataQuery> = store
    .getObject(`grafana.explore.history.${datasourceType}`)
    .map(({ query }: any) => query);

  if (!exploreQueries) {
    return panel.targets;
  }

  const oldQueriesById = keyBy(panel.targets, 'refId');

  const mergedQueries: DataQuery[] = exploreQueries
    .slice(0, queryRowCount)
    .reverse()
    .map(query => ({
      ...oldQueriesById[query.refId],
      ...query,
      context: 'panel',
    }));

  return mergedQueries;
}
