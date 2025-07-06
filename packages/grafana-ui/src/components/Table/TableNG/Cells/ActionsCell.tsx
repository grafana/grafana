import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { ActionButton } from '../../../Actions/ActionButton';
import { ActionCellProps } from '../types';

export const ActionsCell = ({ field, getActions }: ActionCellProps) => {
  const styles = useStyles2(getStyles);
  // const actions = getActions

  return (
    <div className={styles.buttonsGap}>
      {actions && actions.map((action, i) => <ActionButton key={i} action={action} variant="secondary" />)}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  buttonsGap: css({
    display: 'flex',
    gap: 6,
  }),
});
