import { memo, useState, type CSSProperties, type JSX } from 'react';

import { VizOrientation } from '@grafana/data';

import { clamp } from '../../utils/clamp';
import { calculateGridDimensions } from '../../utils/squares';

interface Props<V, D> {
  /**
   * Optionally precalculate dimensions to support consistent behavior between repeated
   * values.  Two typical patterns are:
   * 1) Calculate raw values like font size etc and pass them to each vis
   * 2) find the maximum input values and pass that to the vis
   */
  getAlignmentFactors?: (values: V[], width: number, height: number) => D;

  /**
   * Render a single value
   */
  renderValue: (props: VizRepeaterRenderValueProps<V, D>) => JSX.Element;
  height: number;
  width: number;
  source: unknown; // If this changes, new values will be requested
  getValues: () => V[];
  renderCounter: number; // force update of values & render
  orientation: VizOrientation;
  itemSpacing?: number;
  /** When orientation is set to auto layout items in a grid */
  autoGrid?: boolean;
  minVizWidth?: number;
  minVizHeight?: number;
  maxVizHeight?: number;
}

export interface VizRepeaterRenderValueProps<V, D = {}> {
  value: V;
  width: number;
  height: number;
  orientation: VizOrientation;
  alignmentFactors: D;
  /**
   * Total number of values being shown in repeater
   */
  count: number;
}

function VizRepeaterComponent<V, D = {}>({
  getAlignmentFactors,
  renderValue,
  height,
  width,
  source,
  getValues,
  renderCounter,
  orientation,
  itemSpacing = 8,
  autoGrid,
  minVizWidth,
  minVizHeight,
  maxVizHeight,
}: Props<V, D>) {
  // Values are only re-requested when source or renderCounter change, so they are stored
  // alongside those inputs and adjusted during render rather than in an effect.
  const [state, setState] = useState(() => ({ values: getValues(), source, renderCounter }));
  if (state.source !== source || state.renderCounter !== renderCounter) {
    setState({ values: getValues(), source, renderCounter });
  }
  const { values } = state;

  if (autoGrid && orientation === VizOrientation.Auto) {
    const grid = calculateGridDimensions(width, height, itemSpacing, values.length);
    const alignmentFactors = getAlignmentFactors ? getAlignmentFactors(values, grid.width, grid.height) : ({} as D);

    let xGrid = 0;
    let yGrid = 0;
    let items: JSX.Element[] = [];

    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const isLastRow = yGrid === grid.yCount - 1;

      const itemWidth = isLastRow ? grid.widthOnLastRow : grid.width;
      const itemHeight = grid.height;

      const xPos = xGrid * itemWidth + itemSpacing * xGrid;
      const yPos = yGrid * itemHeight + itemSpacing * yGrid;

      const itemStyles: CSSProperties = {
        position: 'absolute',
        left: xPos,
        top: yPos,
        width: `${itemWidth}px`,
        height: `${itemHeight}px`,
      };

      items.push(
        <div key={i} style={itemStyles}>
          {renderValue({
            value,
            width: itemWidth,
            height: itemHeight,
            alignmentFactors,
            orientation,
            count: values.length,
          })}
        </div>
      );

      xGrid++;

      if (xGrid === grid.xCount) {
        xGrid = 0;
        yGrid++;
      }
    }

    return <div style={{ position: 'relative', width: '100%', height: '100%' }}>{items}</div>;
  }

  const itemStyles: CSSProperties = {
    display: 'flex',
  };

  const repeaterStyle: CSSProperties = {
    display: 'flex',
    overflowX: `${minVizWidth ? 'auto' : 'hidden'}`,
    overflowY: `${minVizHeight ? 'auto' : 'hidden'}`,
  };

  let vizHeight = height;
  let vizWidth = width;

  const resolvedOrientation =
    orientation === VizOrientation.Auto
      ? width > height
        ? VizOrientation.Vertical
        : VizOrientation.Horizontal
      : orientation;

  switch (resolvedOrientation) {
    case VizOrientation.Horizontal:
      const defaultVizHeight = (height + itemSpacing) / values.length - itemSpacing;
      repeaterStyle.flexDirection = 'column';
      repeaterStyle.height = `${height}px`;
      repeaterStyle.overflowX = 'hidden';
      repeaterStyle.scrollbarWidth = 'thin';
      itemStyles.marginBottom = `${itemSpacing}px`;
      vizWidth = width;
      vizHeight = clamp(defaultVizHeight, minVizHeight ?? 0, maxVizHeight ?? defaultVizHeight);
      break;
    case VizOrientation.Vertical:
      repeaterStyle.flexDirection = 'row';
      repeaterStyle.justifyContent = 'space-between';
      repeaterStyle.overflowY = 'hidden';
      itemStyles.marginRight = `${itemSpacing}px`;
      vizHeight = height;
      vizWidth = Math.max(width / values.length - itemSpacing + itemSpacing / values.length, minVizWidth ?? 0);
  }

  itemStyles.width = `${vizWidth}px`;
  itemStyles.height = `${vizHeight}px`;

  const alignmentFactors = getAlignmentFactors ? getAlignmentFactors(values, vizWidth, vizHeight) : ({} as D);

  return (
    <div style={repeaterStyle}>
      {values.map((value, index) => {
        return (
          <div key={index} style={getItemStylesForIndex(itemStyles, index, values.length)}>
            {renderValue({
              value,
              width: vizWidth,
              height: vizHeight,
              alignmentFactors,
              orientation: resolvedOrientation,
              count: values.length,
            })}
          </div>
        );
      })}
    </div>
  );
}

// needed to properly forward the generic type through React.memo
// see https://github.com/DefinitelyTyped/DefinitelyTyped/issues/37087#issuecomment-656596623
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export const VizRepeater = memo(VizRepeaterComponent) as typeof VizRepeaterComponent;

/*
 * Removes any padding on the last item
 */
function getItemStylesForIndex(itemStyles: CSSProperties, index: number, length: number): CSSProperties {
  if (index === length - 1) {
    return {
      ...itemStyles,
      marginRight: 0,
      marginBottom: 0,
    };
  }
  return itemStyles;
}
