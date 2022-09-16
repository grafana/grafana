import React from 'react';

import { getTagColorsFromName, Icon } from '@grafana/ui';

export interface Props {
  label: string;
  removeIcon: boolean;
  count: number;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export class TagBadge extends React.Component<Props, any> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const { label, removeIcon, count, onClick } = this.props;
    const { color } = getTagColorsFromName(label);

    const tagStyle = {
      backgroundColor: color,
    };

    const countLabel = count !== 0 && <span className="tag-count-label">{`(${count})`}</span>;

    return (
      <span className={`label label-tag`} style={tagStyle}>
        {removeIcon && <Icon onClick={onClick} name="times" />}
        {label} {countLabel}
      </span>
    );
  }
}
