import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { ActionButton } from '../Actions/ActionButton';

import { TableCellProps } from './types';

export const ActionsCell = (props: TableCellProps) => {
  const { cellProps, tableStyles, actions } = props;

  const styles = useStyles2(getStyles);

  return (
    <div {...cellProps} className={cx(tableStyles.cellContainerText, styles.buttonsGap)}>
      {actions && actions.map((action, i) => <ActionButton key={i} action={action} variant="secondary" />)}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  buttonsGap: css({
    gap: 6,
  }),
});
