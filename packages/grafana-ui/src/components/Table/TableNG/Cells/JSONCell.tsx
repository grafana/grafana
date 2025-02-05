import { css } from '@emotion/css';
import { isString } from 'lodash';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../themes';
import { CellNGProps } from '../types';

export const JSONCell = ({ value }: Omit<CellNGProps, 'theme' | 'field'>) => {
  const styles = useStyles2(getStyles);

  let localValue = value;
  let displayValue = localValue;

  if (isString(localValue)) {
    try {
      localValue = JSON.parse(localValue);
    } catch {} // ignore errors
  } else {
    displayValue = JSON.stringify(localValue, null, ' ');
  }

  // TODO: Implement DataLinksContextMenu + actions
  return <div className={styles.jsonText}>{displayValue}</div>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  jsonText: css({
    cursor: 'pointer',
    fontFamily: 'monospace',
  }),
});
