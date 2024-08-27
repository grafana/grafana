// import { isFunction } from 'lodash';

import { ThresholdsConfig, ThresholdsMode, VizOrientation, getFieldConfigWithMinMax } from '@grafana/data';
import { BarGaugeDisplayMode, BarGaugeValueMode, TableCellDisplayMode } from '@grafana/schema';

import { BarGauge } from '../../../BarGauge/BarGauge';
// import { DataLinksContextMenu, DataLinksContextMenuApi } from '../../DataLinks/DataLinksContextMenu';
// import { TableCellProps } from '../types';
import { getAlignmentFactor, getCellOptions } from '../../utils';
import { CellNGProps } from '../types';

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

export const BarGaugeCell = ({ value, field, theme }: CellNGProps) => {
    const displayValue = field.display!(value);
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

    // const getLinks = () => {
    //     if (!isFunction(field.getLinks)) {
    //         return [];
    //     }

    //     return field.getLinks({ valueRowIndex: row.index });
    // };

    // //   const hasLinks = Boolean(getLinks().length);
    // const alignmentFactors = getAlignmentFactor(field, displayValue, cell.row.index);

    //   const renderComponent = (menuProps: DataLinksContextMenuApi) => {
    //     const { openMenu, targetClassName } = menuProps;

    //     return (

    //     );
    //   };
    console.log('went here');

    return <BarGauge
        width={innerWidth}
        // height={tableStyles.cellHeightInner}
        field={config}
        display={field.display}
        text={{ valueSize: 14 }}
        value={displayValue}
        orientation={VizOrientation.Horizontal}
        theme={theme}
        // alignmentFactors={alignmentFactors}
        //   onClick={openMenu}
        //   className={targetClassName}
        itemSpacing={1}
        lcdCellWidth={8}
        displayMode={barGaugeMode}
        valueDisplayMode={valueDisplayMode}
    />;
};
