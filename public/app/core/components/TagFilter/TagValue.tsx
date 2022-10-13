import React from 'react';

import { TagBadge } from './TagBadge';

export interface Props {
  value: any;
  className: any;
  onClick: React.MouseEventHandler<HTMLDivElement>;
  onRemove: any;
}

export class TagValue extends React.Component<Props, any> {
  constructor(props: Props) {
    super(props);
    this.onClick = this.onClick.bind(this);
  }

  onClick(event: React.MouseEvent<HTMLDivElement>) {
    this.props.onRemove(this.props.value, event);
  }

  render() {
    const { value } = this.props;
    return <TagBadge label={value.label} removeIcon={false} count={0} onClick={this.onClick} />;
  }
}
