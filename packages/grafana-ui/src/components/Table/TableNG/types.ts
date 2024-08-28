import { Field, GrafanaTheme2, TimeRange } from "@grafana/data";

export interface CellNGProps {
    value: any;
    field: Field;
    theme: GrafanaTheme2;

}
export interface BarGaugeCellProps extends CellNGProps {
    height: number;
    timeRange: TimeRange;
}

export interface SparklineCellProps extends BarGaugeCellProps { }
