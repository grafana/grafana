import { ReactTableCellProps } from './types';
import { BarGauge } from '../BarGauge/BarGauge';

export function BarGaugeCell(props: ReactTableCellProps) {
  const { column } = props;

  if (!props.column.field.display) {
    return '';
  }

  /* height: number; */
  /* width: number; */
  /* thresholds: Threshold[]; */
  /* value: DisplayValue; */
  /* maxValue: number; */
  /* minValue: number; */
  /* orientation: VizOrientation; */
  /* itemSpacing?: number; */
  /* displayMode: 'basic' | 'lcd' | 'gradient'; */
  /* onClick?: React.MouseEventHandler<HTMLElement>; */
  /* className?: string; */
  /* showUnfilled?: boolean; */
  /* alignmentFactors?: DisplayValueAlignmentFactors; */

  console.log('BarGaugeCell', props);
  return '1';
  /* const displayValue = column.field.display(props.cell.value); */
  /*  */
  /* return <BarGauge width={column.width} /> */
}
