import React from 'react';

import { MenuItem, ContextMenu } from '@grafana/ui';

import { ContextMenuEvent } from '../types';

import { convertPixelCoordinatesToBarCoordinates } from './FlameGraph';
import { ItemWithStart } from './dataTransform';

type Props = {
  contextMenuEvent: ContextMenuEvent;
  rangeMin: number;
  rangeMax: number;
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
  rangeMin,
  rangeMax,
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
            if (graphRef.current) {
              const pixelsPerTick = graphRef.current!.clientWidth / totalTicks / (rangeMax - rangeMin);
              const { levelIndex, barIndex } = convertPixelCoordinatesToBarCoordinates(
                contextMenuEvent.e,
                pixelsPerTick,
                levels,
                totalTicks,
                rangeMin
              );

              if (barIndex !== -1 && !isNaN(levelIndex) && !isNaN(barIndex)) {
                setTopLevelIndex(levelIndex);
                setSelectedBarIndex(barIndex);
                setRangeMin(levels[levelIndex][barIndex].start / totalTicks);
                setRangeMax((levels[levelIndex][barIndex].start + levels[levelIndex][barIndex].value) / totalTicks);
                setContextMenuEvent(undefined);
              }
            }
          }}
        />
        <MenuItem
          label="Copy function name"
          icon={'copy'}
          onClick={() => {
            if (graphRef.current) {
              const pixelsPerTick = graphRef.current!.clientWidth / totalTicks / (rangeMax - rangeMin);
              const { levelIndex, barIndex } = convertPixelCoordinatesToBarCoordinates(
                contextMenuEvent.e,
                pixelsPerTick,
                levels,
                totalTicks,
                rangeMin
              );

              if (barIndex !== -1 && !isNaN(levelIndex) && !isNaN(barIndex)) {
                const bar = levels[levelIndex][barIndex];
                navigator.clipboard.writeText(bar.label).then(() => {
                  setContextMenuEvent(undefined);
                });
              }
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
