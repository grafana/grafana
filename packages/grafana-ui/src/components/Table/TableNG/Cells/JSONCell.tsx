import { css, cx } from '@emotion/css';
import { Property } from 'csstype';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../themes';
import { Button, clearLinkButtonStyles } from '../../../Button';
import { DataLinksContextMenu } from '../../../DataLinks/DataLinksContextMenu';
import { JSONCellProps } from '../types';
import { getCellLinks } from '../utils';

export const JSONCell = ({ value, justifyContent, field, rowIdx }: JSONCellProps) => {
  const styles = useStyles2(getStyles, justifyContent);
  const clearButtonStyle = useStyles2(clearLinkButtonStyles);

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

  const hasLinks = Boolean(getCellLinks(field, rowIdx)?.length);

  // TODO: Implement actions
  return (
    <div className={styles.jsonText}>
      {hasLinks ? (
        <DataLinksContextMenu links={() => getCellLinks(field, rowIdx) || []}>
          {(api) => {
            if (api.openMenu) {
              return (
                <Button className={cx(clearButtonStyle)} onClick={api.openMenu}>
                  {displayValue}
                </Button>
              );
            } else {
              return <>{displayValue}</>;
            }
          }}
        </DataLinksContextMenu>
      ) : (
        displayValue
      )}
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
