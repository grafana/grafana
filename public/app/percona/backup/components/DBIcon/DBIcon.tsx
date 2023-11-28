import { cx } from '@emotion/css';
import React, { FC } from 'react';

import { Tooltip, useStyles } from '@grafana/ui';

import { getStyles } from './DBIcon.styles';
import { DBIconProps, DBIconMap } from './DBIcon.types';
import { Edit, Delete, See, Backup, Cancel, Restore } from './assets';

const Icons: DBIconMap = {
  edit: Edit,
  delete: Delete,
  see: See,
  restore: Restore,
  backup: Backup,
  cancel: Cancel,
};

export const DBIcon: FC<React.PropsWithChildren<DBIconProps>> = ({ type, size, tooltipText, disabled, ...rest }) => {
  const styles = useStyles(getStyles);

  if (!Icons[type]) {
    return null;
  }
  const Icon = Icons[type];
  const IconEl = (
    <span className={cx({ [styles.disabled]: disabled }, styles.iconWrapper)}>
      <Icon size={size} {...rest} />
    </span>
  );

  return tooltipText ? (
    <Tooltip data-testid="DBIcon-tooltip" placement="top" content={tooltipText}>
      {IconEl}
    </Tooltip>
  ) : (
    <>{IconEl}</>
  );
};
