import React from 'react';

import { MenuItem, ContextMenu } from '@grafana/ui';

import { ContextMenuEvent } from '../types';

import { ItemWithStart } from './dataTransform';

type Props = {
  contextMenuEvent: ContextMenuEvent;
  levels: ItemWithStart[][];
  totalTicks: number;
  graphRef: React.RefObject<HTMLCanvasElement>;
  setContextMenuEvent: (event: ContextMenuEvent | undefined) => void;
  setTopLevelIndex: (level: number) => void;
  setSelectedBarIndex: (bar: number) => void;
  setRangeMin: (range: number) => void;
  setRangeMax: (range: number) => void;
};

const FlameGraphContextMenu = ({
  contextMenuEvent,
  graphRef,
  totalTicks,
  levels,
  setContextMenuEvent,
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
            if (graphRef.current && contextMenuEvent) {
              setTopLevelIndex(contextMenuEvent.levelIndex);
              setSelectedBarIndex(contextMenuEvent.barIndex);
              setRangeMin(levels[contextMenuEvent.levelIndex][contextMenuEvent.barIndex].start / totalTicks);
              setRangeMax(
                (levels[contextMenuEvent.levelIndex][contextMenuEvent.barIndex].start +
                  levels[contextMenuEvent.levelIndex][contextMenuEvent.barIndex].value) /
                  totalTicks
              );
              setContextMenuEvent(undefined);
            }
          }}
        />
        <MenuItem
          label="Copy function name"
          icon={'copy'}
          onClick={() => {
            if (graphRef.current && contextMenuEvent) {
              const bar = levels[contextMenuEvent.levelIndex][contextMenuEvent.barIndex];
              navigator.clipboard.writeText(bar.label).then(() => {
                setContextMenuEvent(undefined);
              });
            }
          }}
        />
      </>
    );
  };

  return (
    <>
      {contextMenuEvent && (
        <ContextMenu
          renderMenuItems={() => renderMenuItems()}
          x={contextMenuEvent.e.clientX + 10}
          y={contextMenuEvent.e.clientY}
          focusOnOpen={false}
        ></ContextMenu>
      )}
    </>
  );
};

export default FlameGraphContextMenu;
