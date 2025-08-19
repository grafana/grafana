import { css } from '@emotion/css';

import { ActionButton } from '../../../Actions/ActionButton';
import { ActionCellProps, TableCellStyles } from '../types';

export const ActionsCell = ({ field, rowIdx, getActions }: ActionCellProps) => {
  const actions = getActions(field, rowIdx);

  if (actions.length === 0) {
    return null;
  }

  return actions.map((action, i) => <ActionButton key={i} action={action} variant="secondary" />);
};

export const getStyles: TableCellStyles = (theme) => css({ gap: theme.spacing(0.75) });
