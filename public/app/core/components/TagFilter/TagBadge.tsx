import React from 'react';
import tags from 'app/core/utils/tags';

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
    const { color, borderColor } = tags.getTagColorsFromName(label);
    const tagStyle = {
      backgroundColor: color,
      borderColor: borderColor,
    };
    const countLabel = count !== 0 && <span className="tag-count-label">{`(${count})`}</span>;

    return (
      <span className={`label label-tag`} onClick={this.onClick} style={tagStyle}>
        {removeIcon && <i className="fa fa-remove" />}
        {label} {countLabel}
      </span>
    );
  }
}
