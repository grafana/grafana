import React from 'react';

import { MenuItem, ContextMenu } from '@grafana/ui';

import { ContextMenuData } from '../types';

import { FlameGraphDataContainer, LevelItem } from './dataTransform';

type Props = {
  contextMenuData: ContextMenuData;
  data: FlameGraphDataContainer;
  levels: LevelItem[][];
  totalTicks: number;
  graphRef: React.RefObject<HTMLCanvasElement>;
  setContextMenuData: (event: ContextMenuData | undefined) => void;
  setTopLevelIndex: (level: number) => void;
  setSelectedBarIndex: (bar: number) => void;
  setRangeMin: (range: number) => void;
  setRangeMax: (range: number) => void;
};

const FlameGraphContextMenu = ({
  contextMenuData,
  graphRef,
  totalTicks,
  levels,
  setContextMenuData,
  setTopLevelIndex,
  setSelectedBarIndex,
  setRangeMin,
  setRangeMax,
  data,
}: Props) => {
  const clickedItem = levels[contextMenuData.levelIndex][contextMenuData.barIndex];

  const renderMenuItems = () => {
    return (
      <>
        <MenuItem
          label="Focus block"
          icon={'eye'}
          onClick={() => {
            if (graphRef.current && contextMenuData) {
              setTopLevelIndex(contextMenuData.levelIndex);
              setSelectedBarIndex(contextMenuData.barIndex);
              setRangeMin(clickedItem.start / totalTicks);
              setRangeMax((clickedItem.start + data.getValue(clickedItem.itemIndex)) / totalTicks);
              setContextMenuData(undefined);
            }
          }}
        />
        <MenuItem
          label="Copy function name"
          icon={'copy'}
          onClick={() => {
            if (graphRef.current && contextMenuData) {
              navigator.clipboard.writeText(data.getLabel(clickedItem.itemIndex)).then(() => {
                setContextMenuData(undefined);
              });
            }
          }}
        />
      </>
    );
  };

  return (
    <div data-testid="contextMenu">
      {contextMenuData.e.clientX && contextMenuData.e.clientY && (
        <ContextMenu
          renderMenuItems={() => renderMenuItems()}
          x={contextMenuData.e.clientX + 10}
          y={contextMenuData.e.clientY}
          focusOnOpen={false}
        ></ContextMenu>
      )}
    </div>
  );
};

export default FlameGraphContextMenu;
