import { ThresholdsConfig, ThresholdsMode, VizOrientation, getFieldConfigWithMinMax } from '@grafana/data';
import { BarGaugeDisplayMode, BarGaugeValueMode, TableCellDisplayMode } from '@grafana/schema';

import { BarGauge } from '../../../BarGauge/BarGauge';
import { MaybeWrapWithLink } from '../MaybeWrapWithLink';
import { TABLE } from '../constants';
import { BarGaugeCellProps } from '../types';
import { getCellOptions, getAlignmentFactor } from '../utils';

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

export const BarGaugeCell = ({ value, field, theme, height, width, rowIdx }: BarGaugeCellProps) => {
  const displayValue = field.display!(value);
  const cellOptions = getCellOptions(field);
  const heightOffset = TABLE.CELL_PADDING * 2;

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
  // clamp the height of the gauge so it isn't stretched for large rows
  const renderedHeight = Math.min(height - heightOffset, TABLE.MAX_CELL_HEIGHT);

  return (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      <BarGauge
        width={width}
        height={renderedHeight}
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
    </MaybeWrapWithLink>
  );
};
