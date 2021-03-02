import React from 'react';
import { ContextMenu, ContextMenuProps } from '../ContextMenu/ContextMenu';
import { GraphDimensions } from './GraphTooltip/types';
import {
  FlotDataPoint,
  getValueFromDimension,
  getDisplayProcessor,
  Dimensions,
  dateTimeFormat,
  TimeZone,
  FormattedValue,
} from '@grafana/data';
import { useTheme } from '../../themes';
import { HorizontalGroup } from '../Layout/Layout';
import { FormattedValueDisplay } from '../FormattedValueDisplay/FormattedValueDisplay';
import { SeriesIcon } from '../VizLegend/SeriesIcon';
import { css } from 'emotion';

export type ContextDimensions<T extends Dimensions = any> = { [key in keyof T]: [number, number | undefined] | null };

export type GraphContextMenuProps = ContextMenuProps & {
  getContextMenuSource: () => FlotDataPoint | null;
  timeZone?: TimeZone;
  dimensions?: GraphDimensions;
  contextDimensions?: ContextDimensions;
};

/** @internal */
export const GraphContextMenu: React.FC<GraphContextMenuProps> = ({
  getContextMenuSource,
  timeZone,
  items,
  dimensions,
  contextDimensions,
  ...otherProps
}) => {
  const source = getContextMenuSource();

  //  Do not render items that do not have label specified
  const itemsToRender = items
    ? items.map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label),
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
      <GraphContextMenuHeader
        timestamp={formattedValue}
        seriesColor={source.series.color}
        displayName={source.series.alias || source.series.label}
        displayValue={value}
      />
    );
  };

  return <ContextMenu {...otherProps} items={itemsToRender} renderHeader={renderHeader} />;
};

/** @internal */
export const GraphContextMenuHeader = ({
  timestamp,
  seriesColor,
  displayName,
  displayValue,
}: {
  timestamp: string;
  seriesColor: string;
  displayName: string;
  displayValue: FormattedValue;
}) => {
  const theme = useTheme();

  return (
    <div
      className={css`
        padding: ${theme.spacing.xs} ${theme.spacing.sm};
        font-size: ${theme.typography.size.sm};
        z-index: ${theme.zIndex.tooltip};
      `}
    >
      <strong>{timestamp}</strong>
      <HorizontalGroup>
        <div>
          <SeriesIcon color={seriesColor} />
          <span
            className={css`
              white-space: nowrap;
              padding-left: ${theme.spacing.xs};
            `}
          >
            {displayName}
          </span>
        </div>
        {displayValue && <FormattedValueDisplay value={displayValue} />}
      </HorizontalGroup>
    </div>
  );
};
