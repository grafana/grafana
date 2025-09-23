import { clamp } from 'lodash';
import { PureComponent, CSSProperties } from 'react';
import * as React from 'react';

import { VizOrientation } from '@grafana/data';

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

interface DefaultProps {
  itemSpacing: number;
}

type PropsWithDefaults<V, D> = Props<V, D> & DefaultProps;

interface State<V> {
  values: V[];
}

export class VizRepeater<V, D = {}> extends PureComponent<PropsWithDefaults<V, D>, State<V>> {
  static defaultProps: DefaultProps = {
    itemSpacing: 8,
  };

  constructor(props: PropsWithDefaults<V, D>) {
    super(props);

    this.state = {
      values: props.getValues(),
    };
  }

  componentDidUpdate(prevProps: Props<V, D>) {
    const { renderCounter, source } = this.props;
    if (renderCounter !== prevProps.renderCounter || source !== prevProps.source) {
      this.setState({ values: this.props.getValues() });
    }
  }

  getOrientation(): VizOrientation {
    const { orientation, width, height } = this.props;

    if (orientation === VizOrientation.Auto) {
      if (width > height) {
        return VizOrientation.Vertical;
      } else {
        return VizOrientation.Horizontal;
      }
    }

    return orientation;
  }

  renderGrid() {
    const { renderValue, height, width, itemSpacing, getAlignmentFactors, orientation } = this.props;

    const { values } = this.state;
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

    return <div style={{ position: 'relative' }}>{items}</div>;
  }

  render() {
    const {
      renderValue,
      height,
      width,
      itemSpacing,
      getAlignmentFactors,
      autoGrid,
      orientation,
      maxVizHeight,
      minVizWidth,
      minVizHeight,
    } = this.props;
    const { values } = this.state;

    if (autoGrid && orientation === VizOrientation.Auto) {
      return this.renderGrid();
    }

    const itemStyles: React.CSSProperties = {
      display: 'flex',
    };

    const repeaterStyle: React.CSSProperties = {
      display: 'flex',
      overflow: `${minVizWidth ? 'auto' : 'hidden'} ${minVizHeight ? 'auto' : 'hidden'}`,
    };

    let vizHeight = height;
    let vizWidth = width;

    const resolvedOrientation = this.getOrientation();

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
}

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
