import React, { PureComponent } from 'react';
import classNames from 'classnames';

interface Props {
  title: string;
}

export class PanelHeader extends PureComponent<Props> {
  render() {
    const isFullscreen = false;
    const isLoading = false;
    const panelHeaderClass = classNames({ 'panel-header': true, 'grid-drag-handle': !isFullscreen });
    const { title } = this.props;

    return (
      <div className={panelHeaderClass}>
        <span className="panel-info-corner">
          <i className="fa" />
          <span className="panel-info-corner-inner" />
        </span>

        {isLoading && (
          <span className="panel-loading">
            <i className="fa fa-spinner fa-spin" />
          </span>
        )}

        <div className="panel-title-container">
          <div className="panel-title">
            <span className="icon-gf panel-alert-icon" />
            <span className="panel-title-text" data-toggle="dropdown">
              {title} <span className="fa fa-caret-down panel-menu-toggle" />
            </span>

            {this.props.children}
            <span className="panel-time-info">
              <i className="fa fa-clock-o" /> 4m
            </span>
          </div>
        </div>
      </div>
    );
  }
}
