import React from 'react';

export interface IProps {
  label: string;
  removeIcon: boolean;
  count: number;
  onClick: any;
}

export class TagBadge extends React.Component<IProps, any> {
  constructor(props) {
    super(props);
    this.onClick = this.onClick.bind(this);
  }

  onClick(event) {
    this.props.onClick(event);
  }

  render() {
    const { label, removeIcon, count } = this.props;

    return (
      <span className={`label label-tag`} onClick={this.onClick}>
        {removeIcon && <i className="fa fa-remove" />}
        {label} {count !== 0 && count}
      </span>
    );
  }
}
