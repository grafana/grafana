import { css } from '@emotion/css';
import { Property } from 'csstype';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { renderSingleLink } from '../../DataLinksActionsTooltip';
import { useSingleLink } from '../hooks';
import { JSONCellProps } from '../types';

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

  const link = useSingleLink(field, rowIdx);

  return <div className={styles.jsonText}>{link == null ? displayValue : renderSingleLink(link, displayValue)}</div>;
};

const getStyles = (theme: GrafanaTheme2, justifyContent: Property.JustifyContent) => ({
  jsonText: css({
    display: 'flex',
    cursor: 'pointer',
    fontFamily: 'monospace',
    justifyContent: justifyContent,
  }),
});
