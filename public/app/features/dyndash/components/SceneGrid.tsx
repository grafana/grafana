import React, { FC } from 'react';
import ReactGridLayout from 'react-grid-layout';
import AutoSizer from 'react-virtualized-auto-sizer';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';
import { SceneView } from './SceneView';
import { SceneVizView } from './VizPanel';
import { SceneItem } from '../models';
import { ComponentView } from './ComponentView';

export interface Props {
  panels: SceneItem[];
}

export const SceneGrid: FC<Props> = ({ panels }) => {
  const layout = panels.map(panel => {
    return {
      i: panel.id,
      x: panel.gridPos.x,
      y: panel.gridPos.y,
      w: panel.gridPos.w,
      h: panel.gridPos.h,
    };
  });

  return (
    <AutoSizer>
      {({ width }) => {
        if (width === 0) {
          return null;
        }

        return (
          <ReactGridLayout
            width={width}
            className={'layout'}
            isDraggable={false}
            isResizable={false}
            containerPadding={[0, 0]}
            useCSSTransforms={false}
            margin={[GRID_CELL_VMARGIN, GRID_CELL_VMARGIN]}
            cols={GRID_COLUMN_COUNT}
            rowHeight={GRID_CELL_HEIGHT}
            draggableHandle=".grid-drag-handle"
            layout={layout}
          >
            {panels.map(panel => (
              <div key={panel.id} id={panel.id}>
                <ScenePanelView panel={panel} key={panel.id} />
              </div>
            ))}
          </ReactGridLayout>
        );
      }}
    </AutoSizer>
  );
};

interface PanelProps {
  panel: SceneItem;
}

const ScenePanelView: FC<PanelProps> = ({ panel }) => {
  switch (panel.type) {
    case 'viz':
      return <SceneVizView panel={panel} />;
    case 'scene':
      return <SceneView model={panel} />;
    case 'component':
      return <ComponentView panel={panel} />;
  }
};
