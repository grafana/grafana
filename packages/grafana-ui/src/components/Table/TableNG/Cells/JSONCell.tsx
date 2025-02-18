import { css, cx } from '@emotion/css';
import { Property } from 'csstype';
import { isString } from 'lodash';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../themes';
import { Button, clearLinkButtonStyles } from '../../../Button';
import { DataLinksContextMenu } from '../../../DataLinks/DataLinksContextMenu';
import { CellNGProps } from '../types';
import { getCellLinks } from '../utils';

export const JSONCell = ({ value, justifyContent, field, rowIdx, actions }: Omit<CellNGProps, 'theme'>) => {
  const styles = useStyles2(getStyles, justifyContent);
  const clearButtonStyle = useStyles2(clearLinkButtonStyles);

  let localValue = value;
  let displayValue = localValue;

  if (isString(localValue)) {
    try {
      localValue = JSON.parse(localValue);
    } catch {} // ignore errors
  } else {
    displayValue = JSON.stringify(localValue, null, ' ');
  }

  const hasLinks = Boolean(getCellLinks(field, rowIdx)?.length);
  const hasActions = Boolean(actions?.length);

  return (
    <div className={styles.jsonText}>
      {hasLinks || hasActions ? (
        <DataLinksContextMenu links={() => getCellLinks(field, rowIdx) || []} actions={actions}>
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
