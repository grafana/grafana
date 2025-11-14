import { t } from '@grafana/i18n';
import appEvents from 'app/core/app_events';
import { ShowConfirmModalEvent, ShowModalReactEvent } from 'app/types/events';

import { ConvertMixedGridsModal } from '../layout-rows/ConvertMixedGridsModal';

import { GridLayoutType, mapIdToGridLayoutType } from './utils';

export interface UngroupConfirmationOptions {
  hasNonGridLayout: boolean;
  gridTypes: Set<string>;
  onConfirm: (gridLayoutType: GridLayoutType) => void;
  onConvertMixedGrids: (availableIds: Set<string>) => void;
}

export function showUngroupConfirmation({
  hasNonGridLayout,
  gridTypes,
  onConfirm,
  onConvertMixedGrids,
}: UngroupConfirmationOptions) {
  if (hasNonGridLayout) {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('dashboard.layout.ungroup-nested-title', 'Ungroup nested groups?'),
        text: t('dashboard.layout.ungroup-nested-text', 'This will ungroup all nested groups.'),
        yesText: t('dashboard.layout.continue', 'Continue'),
        noText: t('dashboard.layout.cancel', 'Cancel'),
        onConfirm: () => {
          if (gridTypes.size > 1) {
            requestAnimationFrame(() => {
              onConvertMixedGrids(gridTypes);
            });
          } else {
            const gridLayoutType = mapIdToGridLayoutType(gridTypes.values().next().value);
            if (gridLayoutType) {
              onConfirm(gridLayoutType);
            }
          }
        },
      })
    );
    return;
  }

  if (gridTypes.size > 1) {
    onConvertMixedGrids(gridTypes);
    return;
  } else {
    const gridLayoutType = mapIdToGridLayoutType(gridTypes.values().next().value);
    if (gridLayoutType) {
      onConfirm(gridLayoutType);
    }
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
