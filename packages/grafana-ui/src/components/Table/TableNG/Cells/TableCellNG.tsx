
import { ReactNode } from "react";

import { TableCellDisplayMode } from "@grafana/schema";

import AutoCell from "./AutoCell";




// interface TableCellNGProps {
//     fieldConfig: FieldConfig;
//     fieldDisplay: any?
// }


export function TableCellNG(props: any) {
    const { field: shallowField, value } = props;
    const { config: fieldConfig } = shallowField;
    const { type: cellType } = fieldConfig.custom.cellOptions;

    // Get the correct cell type
    let cell: ReactNode = null;
    switch (cellType) {
        case TableCellDisplayMode.Auto:
        default:
            cell = <AutoCell value={value} field={shallowField} />
    }

    return cell;
}




