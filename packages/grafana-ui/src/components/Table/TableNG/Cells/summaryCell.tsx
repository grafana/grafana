import { GrafanaTheme2, Field } from '@grafana/data';

import { TableRow } from '../types';
import { getFooterItemNG, getFooterStyles } from '../utils';

interface SummaryCellProps {
  sortedRows: TableRow[];
  field: Field;
  fieldIndex: number;
  theme: GrafanaTheme2;
}

export const SummaryCell = ({ sortedRows, field, fieldIndex, theme }: SummaryCellProps) => {
  const footerStyles = getFooterStyles(theme);
  const footerItem = getFooterItemNG(sortedRows, field);

  if (!footerItem) {
    return null;
  }

  // Render each reducer in the footer
  return (
    <div className={footerStyles.footerCell}>
      {Object.entries(footerItem).map(([reducerId, { reducerName, formattedValue }]) => (
        <div key={reducerId} className={footerStyles.footerItem}>
          <div className={footerStyles.footerItemLabel}>{reducerName}</div>
          <div className={footerStyles.footerItemValue}>{formattedValue}</div>
        </div>
      ))}
    </div>
  );
};
