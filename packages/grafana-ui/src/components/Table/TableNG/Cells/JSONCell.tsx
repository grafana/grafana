import { css } from '@emotion/css';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { MaybeWrapWithLink } from '../MaybeWrapWithLink';
import { JSONCellProps } from '../types';

export const JSONCell = ({ value, field, rowIdx }: JSONCellProps) => {
  const styles = useStyles2(getStyles);

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
    <span className={styles.jsonText}>
      <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
        {displayValue}
      </MaybeWrapWithLink>
    </span>
  );
};

const getStyles = () => ({
  jsonText: css({
    cursor: 'pointer',
    fontFamily: 'monospace',
  }),
});
