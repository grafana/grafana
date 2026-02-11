import { MouseEvent, useCallback, useMemo } from 'react';

import { Stack } from '@grafana/ui';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { AutoGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-default/DefaultGridLayoutManager';

import { NewDashboardEmptyGridPillTooltip } from './NewDashboardEmptyGridPillTooltip';
import { NewDashboardEmptyPill } from './NewDashboardEmptyPill';

interface Props {
  dashboard: DashboardScene;
}

export const NewDashboardEmptyGridSelector = ({ dashboard }: Props) => {
  const { editPane, defaultGrid } = dashboard.useState();

  const isAuto = useMemo(() => defaultGrid === 'AutoGridLayout', [defaultGrid]);

  const changeDefaultGrid = useCallback(
    (evt: MouseEvent, grid: 'AutoGridLayout' | 'GridLayout') => {
      evt.preventDefault();
      evt.stopPropagation();

      dashboard.setDefaultGrid(grid);

      if (editPane.state.openPane !== 'add') {
        editPane.enableSelection();
      } else {
        editPane.openPane('add');
      }
    },
    [dashboard, editPane]
  );

  const commonGridSvgProps = useMemo(
    () => ({
      style: {
        stroke: 'rgba(204, 204, 220, 0.12)',
        strokeWidth: 1,
        fill: '#181b1f',
      },
      rx: 8,
      ry: 8,
    }),
    []
  );

  const commonAutoGridSvgProps = useMemo(
    () => ({
      ...commonGridSvgProps,
      width: 156,
      height: 156,
    }),
    [commonGridSvgProps]
  );

  return (
    <Stack alignItems="center" justifyContent="center" direction="row" gap={3}>
      <NewDashboardEmptyPill
        selected={isAuto}
        label={AutoGridLayoutManager.descriptor.name}
        tooltip={
          <NewDashboardEmptyGridPillTooltip
            img={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" fill="#111217">
                <rect {...commonAutoGridSvgProps} x="8" y="8" />
                <rect {...commonAutoGridSvgProps} x="172" y="8" />
                <rect {...commonAutoGridSvgProps} x="336" y="8" />
                <rect {...commonAutoGridSvgProps} x="8" y="172" />
                <rect {...commonAutoGridSvgProps} x="172" y="172" />
                <rect {...commonAutoGridSvgProps} x="336" y="172" />
                <rect {...commonAutoGridSvgProps} x="8" y="336" />
                <rect {...commonAutoGridSvgProps} x="172" y="336" />
                <rect {...commonAutoGridSvgProps} x="336" y="336" />
              </svg>
            }
            description={AutoGridLayoutManager.descriptor.description!}
          />
        }
        onClick={(evt) => changeDefaultGrid(evt, 'AutoGridLayout')}
      />
      <NewDashboardEmptyPill
        selected={!isAuto}
        label={DefaultGridLayoutManager.descriptor.name}
        tooltip={
          <NewDashboardEmptyGridPillTooltip
            img={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" fill="#111217">
                <rect {...commonAutoGridSvgProps} width="156" height="284" x="8" y="8" />
                <rect {...commonAutoGridSvgProps} width="320" height="120" x="172" y="8" />
                <rect {...commonAutoGridSvgProps} width="156" height="156" x="172" y="136" />
                <rect {...commonAutoGridSvgProps} width="156" height="156" x="336" y="136" />
                <rect {...commonAutoGridSvgProps} width="320" height="192" x="8" y="300" />
                <rect {...commonAutoGridSvgProps} width="156" height="192" x="336" y="300" />
              </svg>
            }
            description={DefaultGridLayoutManager.descriptor.description!}
          />
        }
        onClick={(evt) => changeDefaultGrid(evt, 'GridLayout')}
      />
    </Stack>
  );
};
