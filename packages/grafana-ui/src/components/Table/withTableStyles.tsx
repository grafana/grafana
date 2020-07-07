import { CellComponent, TableCellProps } from './types';
import { TableStyles } from './styles';

export const withTableStyles = (
  CellComponent: CellComponent,
  getExtendedStyles: (props: TableCellProps) => TableStyles
): CellComponent => {
  function WithTableStyles(props: TableCellProps) {
    return CellComponent({ ...props, tableStyles: getExtendedStyles(props) });
  }

  WithTableStyles.displayName = CellComponent.displayName || CellComponent.name;
  return WithTableStyles;
};
