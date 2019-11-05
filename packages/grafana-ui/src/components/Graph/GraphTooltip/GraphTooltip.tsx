import React from 'react';
import { TooltipContentProps } from '../../Chart/Tooltip';
import { SingleModeGraphTooltip } from './SingleModeGraphTooltip';
import { MultiModeGraphTooltip } from './MultiModeGraphTooltip';
import { GraphDimensions } from './types';

export const GraphTooltip: React.FC<TooltipContentProps<GraphDimensions>> = ({
  mode = 'single',
  dimensions,
  activeDimensions,
  pos,
}) => {
  // When
  // [1] no active dimension or
  // [2] no xAxis position
  // we assume no tooltip should be rendered
  if (!activeDimensions || !activeDimensions.xAxis) {
    return null;
  }

  if (mode === 'single') {
    return <SingleModeGraphTooltip dimensions={dimensions} activeDimensions={activeDimensions} />;
  } else {
    return <MultiModeGraphTooltip dimensions={dimensions} activeDimensions={activeDimensions} pos={pos} />;
  }
};

GraphTooltip.displayName = 'GraphTooltip';
