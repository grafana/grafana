import React, { useContext } from 'react';
import { ContextMenu, ContextMenuProps } from '../ContextMenu/ContextMenu';
import { ThemeContext } from '../../themes';
import { SeriesIcon } from '../Legend/SeriesIcon';
import { GraphDimensions } from './GraphTooltip/types';
import {
  FlotDataPoint,
  getValueFromDimension,
  getDisplayProcessor,
  formattedValueToString,
  Dimensions,
  dateTimeFormat,
  TimeZone,
} from '@grafana/data';
import { css } from 'emotion';

export type ContextDimensions<T extends Dimensions = any> = { [key in keyof T]: [number, number | undefined] | null };

export type GraphContextMenuProps = ContextMenuProps & {
  getContextMenuSource: () => FlotDataPoint | null;
  timeZone?: TimeZone;
  dimensions?: GraphDimensions;
  contextDimensions?: ContextDimensions;
};

export const GraphContextMenu: React.FC<GraphContextMenuProps> = ({
  getContextMenuSource,
  timeZone,
  items,
  dimensions,
  contextDimensions,
  ...otherProps
}) => {
  const theme = useContext(ThemeContext);
  const source = getContextMenuSource();

  //  Do not render items that do not have label specified
  const itemsToRender = items
    ? items.map(group => ({
        ...group,
        items: group.items.filter(item => item.label),
      }))
    : [];

  const renderHeader = () => {
    if (!source) {
      return null;
    }

    // If dimensions supplied, we can calculate and display value
    let value;
    if (dimensions?.yAxis && contextDimensions?.yAxis?.[1]) {
      const valueFromDimensions = getValueFromDimension(
        dimensions.yAxis,
        contextDimensions.yAxis[0],
        contextDimensions.yAxis[1]
      );
      const display =
        source.series.valueField.display ??
        getDisplayProcessor({
          field: source.series.valueField,
          timeZone,
        });
      value = display(valueFromDimensions);
    }

    const formattedValue = dateTimeFormat(source.datapoint[0], {
      defaultWithMS: source.series.hasMsResolution,
      timeZone,
    });

    return (
      <div
        className={css`
          padding: ${theme.spacing.xs} ${theme.spacing.sm};
          font-size: ${theme.typography.size.sm};
          z-index: ${theme.zIndex.tooltip};
        `}
      >
        <strong>{formattedValue}</strong>
        <div>
          <SeriesIcon color={source.series.color} />
          <span
            className={css`
              white-space: nowrap;
              padding-left: ${theme.spacing.xs};
            `}
          >
            {source.series.alias || source.series.label}
          </span>
          {value && (
            <span
              className={css`
                white-space: nowrap;
                padding-left: ${theme.spacing.md};
              `}
            >
              {formattedValueToString(value)}
            </span>
          )}
        </div>
      </div>
    );
  };

  return <ContextMenu {...otherProps} items={itemsToRender} renderHeader={renderHeader} />;
};
