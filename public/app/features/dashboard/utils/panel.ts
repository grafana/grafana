import { type TimeRange, AppEvents, type PanelModel as IPanelModel, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { appEvents } from 'app/core/app_events';
import config from 'app/core/config';
import { LS_PANEL_COPY_KEY, PANEL_BORDER } from 'app/core/constants';
import { ShareModal } from 'app/features/dashboard/components/ShareModal/ShareModal';
import { type DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { UnlinkModal } from 'app/features/dashboard-scene/scene/UnlinkModal';
import { AddLibraryPanelModal } from 'app/features/library-panels/components/AddLibraryPanelModal/AddLibraryPanelModal';
import { cleanUpPanelState } from 'app/features/panel/state/actions';
import { dispatch } from 'app/store/store';

import { ShowConfirmModalEvent, ShowModalReactEvent } from '../../../types/events';

export const removePanel = (dashboard: DashboardModel, panel: PanelModel, ask: boolean) => {
  // confirm deletion
  if (ask !== false) {
    const confirmText = panel.alert ? 'YES' : undefined;

    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('dashboard.remove-panel.title.remove-panel', 'Remove panel'),
        text: t('dashboard.remove-panel.text.remove-panel', 'Are you sure you want to remove this panel?'),
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
