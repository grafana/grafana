import { formattedValueToString } from "@grafana/data";

import { CellNGProps } from "../types"


export default function AutoCell({ value, field }: CellNGProps) {
    const displayValue = field.display!(value);
    const formattedValue = formattedValueToString(displayValue);
    return (<>{formattedValue}</>)
}
