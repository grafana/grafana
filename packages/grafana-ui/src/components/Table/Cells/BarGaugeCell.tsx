import { isFunction } from 'lodash';
import { useState } from 'react';

import { ThresholdsConfig, ThresholdsMode, VizOrientation, getFieldConfigWithMinMax } from '@grafana/data';
import { BarGaugeDisplayMode, BarGaugeValueMode, TableCellDisplayMode } from '@grafana/schema';

import { BarGauge } from '../../BarGauge/BarGauge';
import { DataLinksActionsTooltip, renderSingleLink } from '../DataLinksActionsTooltip';
import { TableCellProps } from '../types';
import {
  DataLinksActionsTooltipCoords,
  getAlignmentFactor,
  getCellOptions,
  getDataLinksActionsTooltipUtils,
} from '../utils';

const defaultScale: ThresholdsConfig = {
  mode: ThresholdsMode.Absolute,
  steps: [
    {
      color: 'blue',
      value: -Infinity,
    },
    {
      color: 'green',
      value: 20,
    },
  ],
};

export const BarGaugeCell = (props: TableCellProps) => {
  const { field, innerWidth, tableStyles, cell, cellProps, row } = props;
  const displayValue = field.display!(cell.value);
  const cellOptions = getCellOptions(field);

  let config = getFieldConfigWithMinMax(field, false);
  if (!config.thresholds) {
    config = {
      ...config,
      thresholds: defaultScale,
    };
  }

  // Set default display mode and update if defined
  // and update the valueMode if defined
  let barGaugeMode: BarGaugeDisplayMode = BarGaugeDisplayMode.Gradient;
  let valueDisplayMode: BarGaugeValueMode | undefined = undefined;

  if (cellOptions.type === TableCellDisplayMode.Gauge) {
    barGaugeMode = cellOptions.mode ?? BarGaugeDisplayMode.Gradient;
    valueDisplayMode =
      cellOptions.valueDisplayMode !== undefined ? cellOptions.valueDisplayMode : BarGaugeValueMode.Text;
  }

  const getLinks = () => {
    if (!isFunction(field.getLinks)) {
      return [];
    }

    return field.getLinks({ valueRowIndex: row.index });
  };

  const alignmentFactors = getAlignmentFactor(field, displayValue, cell.row.index);

  const renderComponent = () => {
    return (
      <BarGauge
        width={innerWidth}
        height={tableStyles.cellHeightInner}
        field={config}
        display={field.display}
        text={{ valueSize: 14 }}
        value={displayValue}
        orientation={VizOrientation.Horizontal}
        theme={tableStyles.theme}
        alignmentFactors={alignmentFactors}
        itemSpacing={1}
        lcdCellWidth={8}
        displayMode={barGaugeMode}
        valueDisplayMode={valueDisplayMode}
      />
    );
  };

  const [tooltipCoords, setTooltipCoords] = useState<DataLinksActionsTooltipCoords>();
  const { shouldShowLink, hasMultipleLinksOrActions } = getDataLinksActionsTooltipUtils(getLinks());
  const shouldShowTooltip = hasMultipleLinksOrActions && tooltipCoords !== undefined;

  const links = getLinks();

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      {...cellProps}
      className={tableStyles.cellContainer}
      style={{ ...cellProps.style, cursor: hasMultipleLinksOrActions ? 'context-menu' : 'auto' }}
      onClick={({ clientX, clientY }) => {
        setTooltipCoords({ clientX, clientY });
      }}
    >
      {shouldShowLink ? (
        renderSingleLink(links[0], renderComponent())
      ) : shouldShowTooltip ? (
        <DataLinksActionsTooltip
          links={links}
          value={renderComponent()}
          coords={tooltipCoords}
          onTooltipClose={() => setTooltipCoords(undefined)}
        />
      ) : (
        renderComponent()
      )}
    </div>
  );
};
