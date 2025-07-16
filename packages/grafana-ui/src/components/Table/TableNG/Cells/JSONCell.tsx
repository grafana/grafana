import { css } from '@emotion/css';
import { Property } from 'csstype';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { JSONCellProps } from '../types';

import { TableCellLinkWraper } from './TableCellLinkWrapper';

export const JSONCell = ({ value, justifyContent, field, rowIdx }: JSONCellProps) => {
  const styles = useStyles2(getStyles, justifyContent);

  let displayValue = value;

  // Handle string values that might be JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      displayValue = JSON.stringify(parsed, null, ' ');
    } catch {
      displayValue = value; // Keep original if not valid JSON
    }
  } else {
    // For non-string values, stringify them
    try {
      displayValue = JSON.stringify(value, null, ' ');
    } catch (error) {
      // Handle circular references or other stringify errors
      displayValue = String(value);
    }
  }

  return (
    <div className={styles.jsonText}>
      <TableCellLinkWraper field={field} rowIdx={rowIdx}>
        {displayValue}
      </TableCellLinkWraper>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, justifyContent: Property.JustifyContent) => ({
  jsonText: css({
    display: 'flex',
    cursor: 'pointer',
    fontFamily: 'monospace',
    justifyContent: justifyContent,
  }),
});
