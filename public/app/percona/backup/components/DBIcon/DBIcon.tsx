import React, { FC } from 'react';
import { Tooltip } from '@grafana/ui';
import { DBIconProps, DBIconMap } from './DBIcon.types';
import { Edit, Delete, See } from './assets';

const Icons: DBIconMap = {
  edit: Edit,
  delete: Delete,
  see: See,
};

export const DBIcon: FC<DBIconProps> = ({ type, size, tooltipText, ...rest }) => {
  if (!Icons[type]) {
    return null;
  }
  const Icon = Icons[type];
  const IconEl = <Icon size={size} {...rest} />;

  return tooltipText ? (
    <Tooltip placement="top" content={tooltipText}>
      <span>{IconEl}</span>
    </Tooltip>
  ) : (
    IconEl
  );
};
