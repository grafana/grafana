import React from 'react';

import { VizTooltipContentProps } from '../../VizTooltip';

import { MultiModeGraphTooltip } from './MultiModeGraphTooltip';
import { SingleModeGraphTooltip } from './SingleModeGraphTooltip';
import { GraphDimensions } from './types';

export const GraphTooltip: React.FC<VizTooltipContentProps<GraphDimensions>> = ({
  mode = 'single',
  dimensions,
  activeDimensions,
  pos,
  timeZone,
}) => {
  // When
  // [1] no active dimension or
  // [2] no xAxis position
  // we assume no tooltip should be rendered
  if (!activeDimensions || !activeDimensions.xAxis) {
    return null;
  }

  if (mode === 'single') {
    return <SingleModeGraphTooltip dimensions={dimensions} activeDimensions={activeDimensions} timeZone={timeZone} />;
  } else {
    return (
      <MultiModeGraphTooltip
        dimensions={dimensions}
        activeDimensions={activeDimensions}
        pos={pos}
        timeZone={timeZone}
      />
    );
  }
};

GraphTooltip.displayName = 'GraphTooltip';
