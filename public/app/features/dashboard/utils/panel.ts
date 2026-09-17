import { type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { appEvents } from 'app/core/app_events';
import { type DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { type PanelModel } from 'app/features/dashboard/state/PanelModel';
import { cleanUpPanelState } from 'app/features/panel/state/actions';
import { dispatch } from 'app/store/store';

import { ShowConfirmModalEvent } from '../../../types/events';

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

export interface TimeOverrideResult {
  timeRange: TimeRange;
  timeInfo: string;
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
