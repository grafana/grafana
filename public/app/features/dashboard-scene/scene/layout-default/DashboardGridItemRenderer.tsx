import { css } from '@emotion/css';
import { useMemo } from 'react';

import { config } from '@grafana/runtime';
import { SceneComponentProps } from '@grafana/scenes';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN } from 'app/core/constants';

import { renderMatchingSoloPanels, useSoloPanelContext } from '../SoloPanelContext';

import { DashboardGridItem, RepeatDirection } from './DashboardGridItem';

export function DashboardGridItemRenderer({ model }: SceneComponentProps<DashboardGridItem>) {
  const { repeatedPanels = [], itemHeight, variableName, body } = model.useState();
  const soloPanelContext = useSoloPanelContext();
  const layoutStyle = useLayoutStyle(
    model.getRepeatDirection(),
    model.getPanelCount(),
    model.getMaxPerRow(),
    itemHeight ?? 10
  );

  if (soloPanelContext) {
    return renderMatchingSoloPanels(soloPanelContext, [body, ...repeatedPanels]);
  }

  if (!variableName) {
    return (
      <div className={panelWrapper} ref={model.containerRef}>
        <body.Component model={body} key={body.state.key} />
      </div>
    );
  }

  return (
    <div className={layoutStyle} ref={model.containerRef}>
      <div className={panelWrapper} key={body.state.key}>
        <body.Component model={body} key={body.state.key} />
      </div>
      {repeatedPanels.map((panel) => (
        <div className={panelWrapper} key={panel.state.key}>
          <panel.Component model={panel} key={panel.state.key} />
        </div>
      ))}
    </div>
  );
}

function useLayoutStyle(direction: RepeatDirection, itemCount: number, maxPerRow: number, itemHeight: number) {
  return useMemo(() => {
    const theme = config.theme2;

    // In mobile responsive layout we have to calculate the absolute height
    const mobileHeight = itemHeight * GRID_CELL_HEIGHT * itemCount + (itemCount - 1) * GRID_CELL_VMARGIN;

    if (direction === 'h') {
      const rowCount = Math.ceil(itemCount / maxPerRow);
      const columnCount = Math.min(itemCount, maxPerRow);

      return css({
        display: 'grid',
        height: '100%',
        width: '100%',
        gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
        gridTemplateRows: `repeat(${rowCount}, 1fr)`,
        gridColumnGap: theme.spacing(1),
        gridRowGap: theme.spacing(1),

        [theme.breakpoints.down('md')]: {
          display: 'flex',
          flexDirection: 'column',
          height: mobileHeight,
        },
      });
    }

    // Vertical is a bit simpler
    return css({
      display: 'flex',
      height: '100%',
      width: '100%',
      flexDirection: 'column',
      gap: theme.spacing(1),
      [theme.breakpoints.down('md')]: {
        height: mobileHeight,
      },
    });
  }, [direction, itemCount, maxPerRow, itemHeight]);
}

const panelWrapper = css({
  display: 'flex',
  flexGrow: 1,
  position: 'relative',
  width: '100%',
  height: '100%',
});
