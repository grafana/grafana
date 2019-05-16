import React, { PureComponent } from 'react';

interface Props {
  isOpen: boolean;
  label: string;
  loading?: boolean;
  collapsible?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

export default class Panel extends PureComponent<Props> {
  onClickToggle = () => {
    const { onToggle, isOpen } = this.props;
    if (onToggle) {
      onToggle(!isOpen);
    }
  };

  render() {
    const { isOpen, loading, collapsible } = this.props;
    const panelClass = collapsible
      ? 'explore-panel explore-panel--collapsible panel-container'
      : 'explore-panel panel-container';
    const iconClass = isOpen ? 'fa fa-caret-up' : 'fa fa-caret-down';
    const loaderClass = loading ? 'explore-panel__loader explore-panel__loader--active' : 'explore-panel__loader';
    return (
      <div className={panelClass}>
        <div className="explore-panel__header" onClick={this.onClickToggle}>
          <div className="explore-panel__header-buttons">
            <span className={iconClass} />
          </div>
          <div className="explore-panel__header-label">{this.props.label}</div>
        </div>
        {isOpen && (
          <div className="explore-panel__body">
            <div className={loaderClass} />
            {this.props.children}
          </div>
        )}
      </div>
    );
  }
}
