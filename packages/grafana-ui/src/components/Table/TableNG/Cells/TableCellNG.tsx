
import { ReactNode } from "react";

import { TableCellDisplayMode } from "@grafana/schema";

import AutoCell from "./AutoCell";
import { BarGaugeCell } from "./BarGaugeCell";
import { SparklineCell } from "./SparklineCell";



// interface TableCellNGProps {
//     fieldConfig: FieldConfig;
//     fieldDisplay: any?
// }


export function TableCellNG(props: any) {
    const { field: shallowField, value, theme, timeRange, height } = props;
    const { config: fieldConfig } = shallowField;
    const { type: cellType } = fieldConfig.custom.cellOptions;
    console.log(cellType);

    // Get the correct cell type
    let cell: ReactNode = null;
    switch (cellType) {
        // case TableCellDisplayMode.
        case TableCellDisplayMode.Sparkline:
            cell = <SparklineCell value={value} field={shallowField} theme={theme} timeRange={timeRange} height={height} />
            break;
        case TableCellDisplayMode.Gauge:
        case TableCellDisplayMode.BasicGauge:
        case TableCellDisplayMode.GradientGauge:
        case TableCellDisplayMode.LcdGauge:
            cell = <BarGaugeCell value={value} field={shallowField} theme={theme} timeRange={timeRange} height={height} />
            break;
        case TableCellDisplayMode.Auto:
        default:
            cell = <AutoCell value={value} field={shallowField} theme={theme} />
    }

    console.log(cell);

    return cell;
}




