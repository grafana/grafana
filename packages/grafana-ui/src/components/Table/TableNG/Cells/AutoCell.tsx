import { CellNGProps } from "../types"

export default function AutoCell({ value, field }: CellNGProps) {
    const displayValue = field.display!(value);
    console.log(displayValue);


    return (<>{displayValue.text}</>)
}
