import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { ActionButton } from '../../../Actions/ActionButton';
import { ActionCellProps } from '../types';

export const ActionsCell = ({ field, rowIdx, getActions }: ActionCellProps) => {
  const styles = useStyles2(getStyles);

  const actions = useMemo(() => getActions(field, rowIdx), [getActions, field, rowIdx]);

  return (
    <div className={styles.buttonsGap}>
      {actions.map((action, i) => (
        <ActionButton key={i} action={action} variant="secondary" />
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  buttonsGap: css({
    display: 'flex',
    gap: 6,
  }),
});
