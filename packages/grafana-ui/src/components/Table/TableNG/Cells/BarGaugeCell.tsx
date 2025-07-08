import { useState } from 'react';

import { ThresholdsConfig, ThresholdsMode, VizOrientation, getFieldConfigWithMinMax } from '@grafana/data';
import { BarGaugeDisplayMode, BarGaugeValueMode, TableCellDisplayMode } from '@grafana/schema';

import { BarGauge } from '../../../BarGauge/BarGauge';
import { DataLinksActionsTooltip, renderSingleLink } from '../../DataLinksActionsTooltip';
import { tooltipOnClickHandler, DataLinksActionsTooltipCoords, getDataLinksActionsTooltipUtils } from '../../utils';
import { BarGaugeCellProps } from '../types';
import { extractPixelValue, getCellOptions, getAlignmentFactor, getCellLinks } from '../utils';

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

export const BarGaugeCell = ({ value, field, theme, height, width, rowIdx, actions }: BarGaugeCellProps) => {
  const displayValue = field.display!(value);
  const cellOptions = getCellOptions(field);
  const heightOffset = extractPixelValue(theme.spacing(1));

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

  const alignmentFactors = getAlignmentFactor(field, displayValue, rowIdx!);
  const links = getCellLinks(field, rowIdx) || [];

  const [tooltipCoords, setTooltipCoords] = useState<DataLinksActionsTooltipCoords>();
  const { shouldShowLink, hasMultipleLinksOrActions } = getDataLinksActionsTooltipUtils(links, actions);
  const shouldShowTooltip = hasMultipleLinksOrActions && tooltipCoords !== undefined;

  const renderComponent = () => {
    return (
      <BarGauge
        width={width}
        height={height - heightOffset}
        field={config}
        display={field.display}
        text={{ valueSize: 14 }}
        value={displayValue}
        orientation={VizOrientation.Horizontal}
        theme={theme}
        alignmentFactors={alignmentFactors}
        itemSpacing={1}
        lcdCellWidth={8}
        displayMode={barGaugeMode}
        valueDisplayMode={valueDisplayMode}
      />
    );
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
    <div
      style={{ cursor: hasMultipleLinksOrActions ? 'context-menu' : 'auto' }}
      onClick={tooltipOnClickHandler(setTooltipCoords)}
    >
      {shouldShowLink ? (
        renderSingleLink(links[0], renderComponent())
      ) : shouldShowTooltip ? (
        <DataLinksActionsTooltip
          links={links}
          actions={actions}
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
