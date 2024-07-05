import * as React from 'react';

import { getTagColorsFromName, Icon } from '@grafana/ui';

export interface Props {
  label: string;
  removeIcon: boolean;
  count: number;
  onClick?: React.MouseEventHandler<SVGElement>;
}

export const TagBadge = ({ count, label, onClick, removeIcon }: Props) => {
  const { color } = getTagColorsFromName(label);

  const tagStyle = {
    backgroundColor: color,
  };

  const countLabel = count !== 0 && <span style={{ marginLeft: '3px' }}>{`(${count})`}</span>;

  return (
    <span className={`label label-tag`} style={tagStyle}>
      {removeIcon && <Icon onClick={onClick} name="times" />}
      {label} {countLabel}
    </span>
  );
};
