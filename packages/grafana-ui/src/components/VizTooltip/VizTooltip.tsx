import React from 'react';
import { Dimensions, TimeZone } from '@grafana/data';
import { FlotPosition } from '../Graph/types';
import { VizTooltipContainer } from './VizTooltipContainer';
import { TooltipDisplayMode } from './models.gen';

// Describes active dimensions user interacts with
// It's a key-value pair where:
// - key is the name of the dimension
// - value is a tuple addressing which column and row from given dimension is active.
//   If row is undefined, it means that we are not hovering over a datapoint
export type ActiveDimensions<T extends Dimensions = any> = { [key in keyof T]: [number, number | undefined] | null };

export interface VizTooltipContentProps<T extends Dimensions = any> {
  // Each dimension is described by array of fields representing it
  // I.e. for graph there are two dimensions: x and y axis:
  // { xAxis: [<array of time fields>], yAxis: [<array of value fields>]}
  // TODO: type this better, no good idea how yet
  dimensions: T; // Dimension[]
  activeDimensions?: ActiveDimensions<T>;
  timeZone?: TimeZone;
  pos: FlotPosition;
  mode: TooltipDisplayMode;
}

export interface VizTooltipProps {
  /** Element used as tooltips content */
  content?: React.ReactElement<any>;

  /** Optional component to be used as a tooltip content */
  tooltipComponent?: React.ComponentType<VizTooltipContentProps>;

  /** x/y position relative to the window */
  position?: { x: number; y: number };

  /** x/y offset relative to tooltip origin element, i.e. graph's datapoint */
  offset?: { x: number; y: number };

  // Mode in which tooltip works
  // - single - display single series info
  // - multi - display all series info
  mode?: TooltipDisplayMode;
}

/**
 * @public
 */
export const VizTooltip: React.FC<VizTooltipProps> = ({ content, position, offset }) => {
  if (position) {
    return (
      <VizTooltipContainer position={position} offset={offset || { x: 0, y: 0 }}>
        {content}
      </VizTooltipContainer>
    );
  }
  return null;
};

VizTooltip.displayName = 'VizTooltip';
