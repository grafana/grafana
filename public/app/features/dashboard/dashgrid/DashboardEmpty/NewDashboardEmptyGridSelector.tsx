import { MouseEvent, useCallback } from 'react';

import { t } from '@grafana/i18n';
import { Stack } from '@grafana/ui';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { AutoGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-default/DefaultGridLayoutManager';
import { setDefaultGrid } from 'app/features/dashboard-scene/scene/layouts-shared/defaultGridUtils';

import { NewDashboardEmptyPill } from './NewDashboardEmptyPill';

interface Props {
  dashboard: DashboardScene;
}

export const NewDashboardEmptyGridSelector = ({ dashboard }: Props) => {
  const { body, editPane } = dashboard.useState();

  const isAuto = body.descriptor.id === 'AutoGridLayout';

  const changeDefaultGrid = useCallback(
    (evt: MouseEvent, grid: 'AutoGridLayout' | 'GridLayout') => {
      evt.preventDefault();
      evt.stopPropagation();
      const newIsAuto = grid === 'AutoGridLayout';
      const shouldChangeBody = body.descriptor.id !== grid;

      if (shouldChangeBody) {
        dashboard.setState({
          body: newIsAuto ? AutoGridLayoutManager.createEmpty() : DefaultGridLayoutManager.fromVizPanels([]),
        });

        if (editPane.state.openPane !== 'add') {
          editPane.enableSelection();
        } else {
          editPane.openPane('add');
        }
      }

      setDefaultGrid(grid);
    },
    [dashboard, body, editPane]
  );

  return (
    <Stack alignItems="center" justifyContent="center" direction="row" gap={3}>
      <NewDashboardEmptyPill
        selected={isAuto}
        label={t('dashboard.empty.grid-selector.auto', 'Auto grid')}
        onClick={(evt) => changeDefaultGrid(evt, 'AutoGridLayout')}
      />
      <NewDashboardEmptyPill
        selected={!isAuto}
        label={t('dashboard.empty.grid-selector.custom', 'Custom grid')}
        onClick={(evt) => changeDefaultGrid(evt, 'GridLayout')}
      />
    </Stack>
  );
};
