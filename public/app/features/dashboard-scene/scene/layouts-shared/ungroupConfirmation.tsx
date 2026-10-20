import { t } from '@grafana/i18n';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent, ShowModalReactEvent } from 'app/types/events';

import { type NestedGroupsTarget } from '../types/DashboardLayoutGroup';

import { ConvertMixedGridsModal } from './ConvertMixedGridsModal';
import { UngroupGroupsModal } from './UngroupGroupsModal';
import { type GridLayoutType, mapIdToGridLayoutType } from './utils';

export interface UngroupConfirmationOptions {
  gridTypes: Set<string>;
  onConfirm: (gridLayoutType: GridLayoutType) => void;
  onConvertMixedGrids: (availableIds: Set<string>) => void;
}

/** Grid-only ungroup: merge grids directly, or ask for the grid type when grids are mixed */
export function showUngroupConfirmation({ gridTypes, onConfirm, onConvertMixedGrids }: UngroupConfirmationOptions) {
  if (gridTypes.size > 1) {
    onConvertMixedGrids(gridTypes);
    return;
  }

  const gridLayoutType = mapIdToGridLayoutType(gridTypes.values().next().value);
  if (gridLayoutType) {
    onConfirm(gridLayoutType);
  }
}

export function showConvertMixedGridsModal(availableIds: Set<string>, onSelect: (id: string) => void) {
  appEvents.publish(
    new ShowModalReactEvent({
      component: ConvertMixedGridsModal,
      props: {
        availableIds,
        onSelect,
      },
    })
  );
}

export interface UngroupGroupsOptions {
  disabledTabsReason?: string;
  showRepeatLossWarning?: boolean;
  onSelect: (target: NestedGroupsTarget) => void;
}

/** Ask the user how nested groups should be ungrouped: converted to rows or to tabs */
export function showUngroupGroupsModal(props: UngroupGroupsOptions) {
  appEvents.publish(
    new ShowModalReactEvent({
      component: UngroupGroupsModal,
      props,
    })
  );
}

/** Confirm ungrouping when repeat options configured on the dissolved groups would be lost */
export function showRepeatLossConfirmation(onConfirm: () => void) {
  appEvents.publish(
    new ShowConfirmModalEvent({
      title: t('dashboard.layout.ungroup-repeat-loss-title', 'Ungroup?'),
      text: t(
        'dashboard.layout.ungroup-repeat-loss',
        'Repeat options configured on the ungrouped groups will be lost.'
      ),
      yesText: t('dashboard.layout.continue', 'Continue'),
      noText: t('dashboard.layout.cancel', 'Cancel'),
      onConfirm,
    })
  );
}
