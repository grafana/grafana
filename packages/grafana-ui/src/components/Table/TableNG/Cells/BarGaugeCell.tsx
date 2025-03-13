import { ThresholdsConfig, ThresholdsMode, VizOrientation, getFieldConfigWithMinMax } from '@grafana/data';
import { BarGaugeDisplayMode, BarGaugeValueMode, TableCellDisplayMode } from '@grafana/schema';

import { BarGauge } from '../../../BarGauge/BarGauge';
import { DataLinksContextMenu, DataLinksContextMenuApi } from '../../../DataLinks/DataLinksContextMenu';
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

export const BarGaugeCell = ({ value, field, theme, height, width, rowIdx }: BarGaugeCellProps) => {
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

  const hasLinks = Boolean(getCellLinks(field, rowIdx)?.length);

  const alignmentFactors = getAlignmentFactor(field, displayValue, rowIdx!);

  const renderComponent = (menuProps: DataLinksContextMenuApi) => {
    const { openMenu } = menuProps;

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
        onClick={openMenu}
        itemSpacing={1}
        lcdCellWidth={8}
        displayMode={barGaugeMode}
        valueDisplayMode={valueDisplayMode}
      />
    );
  };

  // @TODO: Actions
  return (
    <>
      {hasLinks ? (
        <DataLinksContextMenu
          links={() => getCellLinks(field, rowIdx) || []}
          style={{ display: 'flex', width: '100%' }}
        >
          {(api) => renderComponent(api)}
        </DataLinksContextMenu>
      ) : (
        renderComponent({})
      )}
    </>
  );
};
