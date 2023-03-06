import React from 'react';

import { MenuItem, ContextMenu } from '@grafana/ui';

import { ContextMenuData } from '../types';

import { ItemWithStart } from './dataTransform';

type Props = {
  contextMenuData: ContextMenuData;
  levels: ItemWithStart[][];
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
}: Props) => {
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
              setRangeMin(levels[contextMenuData.levelIndex][contextMenuData.barIndex].start / totalTicks);
              setRangeMax(
                (levels[contextMenuData.levelIndex][contextMenuData.barIndex].start +
                  levels[contextMenuData.levelIndex][contextMenuData.barIndex].value) /
                  totalTicks
              );
              setContextMenuData(undefined);
            }
          }}
        />
        <MenuItem
          label="Copy function name"
          icon={'copy'}
          onClick={() => {
            if (graphRef.current && contextMenuData) {
              const bar = levels[contextMenuData.levelIndex][contextMenuData.barIndex];
              navigator.clipboard.writeText(bar.label).then(() => {
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
