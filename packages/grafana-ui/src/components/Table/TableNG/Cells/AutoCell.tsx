import { css } from '@emotion/css';
import { Property } from 'csstype';

import { GrafanaTheme2, formattedValueToString } from '@grafana/data';

import { useStyles2 } from '../../../../themes';
import { CellNGProps } from '../types';

export default function AutoCell({ value, field, justifyContent }: CellNGProps) {
  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);

  const styles = useStyles2(getStyles, justifyContent);

  return <div className={styles.cell}>{formattedValue}</div>;
}

const getStyles = (theme: GrafanaTheme2, justifyContent: Property.JustifyContent | undefined) => ({
  cell: css({
    display: 'flex',
    justifyContent: justifyContent,
  }),
});
