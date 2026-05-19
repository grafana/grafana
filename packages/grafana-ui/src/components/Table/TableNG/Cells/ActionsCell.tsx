import { css } from '@emotion/css';
import memoize from 'micro-memoize';

import { ActionButton } from '../../../Actions/ActionButton';
import { type ActionCellProps, type TableCellStyles } from '../types';

export const ActionsCell = ({ field, rowIdx, getActions }: ActionCellProps) => {
  const actions = getActions(field, rowIdx);

  if (actions.length === 0) {
    return null;
  }

  return actions.map((action, i) => <ActionButton key={i} action={action} variant="secondary" />);
};

export const getStyles: TableCellStyles = memoize((theme) => css({ gap: theme.spacing(0.75) }));
