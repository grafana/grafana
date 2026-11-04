import { t } from '@grafana/i18n';

import {
  type AutoGridColumnWidth,
  type AutoGridLayoutManager,
  type AutoGridMaxHeightMode,
  type AutoGridMinHeight,
  type AutoGridRowHeight,
} from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { type DashboardActionMeta } from '../../sidebar/events';
import { edit } from '../utils/edit';

/**
 * Records an auto grid option change. The option setters resolve values from the current state
 * (e.g. 'custom') and derive grid templates, so undo restores a snapshot of all option state
 * and redo replays the setter against that restored state.
 */
function changeAutoGridOption(
  layoutManager: AutoGridLayoutManager,
  actionId: DashboardActionMeta['actionId'],
  description: string,
  change: () => void
) {
  const {
    maxColumnCount,
    columnWidth,
    rowHeight,
    fillScreen,
    fitContent,
    minHeight,
    maxHeightMode,
    maxHeight,
    matchRowHeights,
  } = layoutManager.state;
  const { templateColumns, autoRows } = layoutManager.state.layout.state;

  edit({
    meta: { actionId },
    description,
    source: layoutManager,
    perform: change,
    undo: () => {
      layoutManager.setState({
        maxColumnCount,
        columnWidth,
        rowHeight,
        fillScreen,
        fitContent,
        minHeight,
        maxHeightMode,
        maxHeight,
        matchRowHeights,
      });
      layoutManager.state.layout.setState({ templateColumns, autoRows });
    },
  });
}

export function changeAutoGridMaxColumnCount(layoutManager: AutoGridLayoutManager, maxColumnCount: number) {
  changeAutoGridOption(
    layoutManager,
    'layout.changeMaxColumns',
    t('dashboard.edit-actions.auto-grid-max-columns', 'Change max columns'),
    () => layoutManager.onMaxColumnCountChanged(maxColumnCount)
  );
}

export function changeAutoGridColumnWidth(layoutManager: AutoGridLayoutManager, columnWidth: AutoGridColumnWidth) {
  changeAutoGridOption(
    layoutManager,
    'layout.changeColumnWidth',
    t('dashboard.edit-actions.auto-grid-column-width', 'Change min column width'),
    () => layoutManager.onColumnWidthChanged(columnWidth)
  );
}

export function changeAutoGridRowHeight(layoutManager: AutoGridLayoutManager, rowHeight: AutoGridRowHeight) {
  changeAutoGridOption(
    layoutManager,
    'layout.changeRowHeight',
    t('dashboard.edit-actions.auto-grid-row-height', 'Change row height'),
    () => layoutManager.onRowHeightChanged(rowHeight)
  );
}

export function changeAutoGridFillScreen(layoutManager: AutoGridLayoutManager, fillScreen: boolean) {
  changeAutoGridOption(
    layoutManager,
    'layout.changeFillScreen',
    fillScreen
      ? t('dashboard.edit-actions.auto-grid-fill-screen-enable', 'Enable fill screen')
      : t('dashboard.edit-actions.auto-grid-fill-screen-disable', 'Disable fill screen'),
    () => layoutManager.onFillScreenChanged(fillScreen)
  );
}

export function changeAutoGridFitContent(layoutManager: AutoGridLayoutManager, fitContent: boolean) {
  changeAutoGridOption(
    layoutManager,
    'layout.changeFitContent',
    fitContent
      ? t('dashboard.edit-actions.auto-grid-fit-content-enable', 'Enable auto fit')
      : t('dashboard.edit-actions.auto-grid-fit-content-disable', 'Disable auto fit'),
    () => layoutManager.onFitContentChanged(fitContent)
  );
}

export function changeAutoGridMinHeight(layoutManager: AutoGridLayoutManager, minHeight: AutoGridMinHeight) {
  changeAutoGridOption(
    layoutManager,
    'layout.changeMinHeight',
    t('dashboard.edit-actions.auto-grid-min-height', 'Change min height'),
    () => layoutManager.onMinHeightChanged(minHeight)
  );
}

export function changeAutoGridMaxHeightMode(
  layoutManager: AutoGridLayoutManager,
  maxHeightMode: AutoGridMaxHeightMode | undefined
) {
  changeAutoGridOption(
    layoutManager,
    'layout.changeMaxHeight',
    t('dashboard.edit-actions.auto-grid-max-height', 'Change max height'),
    () => layoutManager.onMaxHeightModeChanged(maxHeightMode)
  );
}

export function changeAutoGridMaxHeightCustom(layoutManager: AutoGridLayoutManager, maxHeight: number) {
  changeAutoGridOption(
    layoutManager,
    'layout.changeMaxHeight',
    t('dashboard.edit-actions.auto-grid-max-height', 'Change max height'),
    () => layoutManager.onMaxHeightCustomChanged(maxHeight)
  );
}

export function changeAutoGridMatchRowHeights(layoutManager: AutoGridLayoutManager, matchRowHeights: boolean) {
  changeAutoGridOption(
    layoutManager,
    'layout.changeMatchRowHeights',
    matchRowHeights
      ? t('dashboard.edit-actions.auto-grid-match-row-heights-enable', 'Enable match row heights')
      : t('dashboard.edit-actions.auto-grid-match-row-heights-disable', 'Disable match row heights'),
    () => layoutManager.onMatchRowHeightsChanged(matchRowHeights)
  );
}
