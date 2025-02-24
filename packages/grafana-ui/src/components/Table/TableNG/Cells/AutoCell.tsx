import { css } from '@emotion/css';
import { Property } from 'csstype';

import { GrafanaTheme2, formattedValueToString } from '@grafana/data';

import { useStyles2 } from '../../../../themes';
import { AutoCellProps } from '../types';

export default function AutoCell({ value, field, justifyContent, cellOptions, rowIdx }: AutoCellProps) {
  const styles = useStyles2(getStyles, justifyContent);

  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);

  return <div className={styles.cell}>{formattedValue}</div>;
}

const getStyles = (theme: GrafanaTheme2, justifyContent: Property.JustifyContent | undefined) => ({
  cell: css({
    display: 'flex',
    justifyContent: justifyContent,
  }),
});
