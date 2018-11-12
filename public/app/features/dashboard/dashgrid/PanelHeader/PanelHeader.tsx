import React, { PureComponent } from 'react';
import classNames from 'classnames';

import { PanelHeaderMenu } from './PanelHeaderMenu';

import { DashboardModel } from 'app/features/dashboard/dashboard_model';
import { PanelModel } from 'app/features/dashboard/panel_model';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  isEditing: boolean;
  isFullscreen: boolean;
}

export interface State {
  title: string;
  titleEditable: boolean;
}

export class PanelHeader extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      title: props.panel.title,
      titleEditable: false,
    };
  }

  onToggleEditTitle = () => {
    if (this.props.isEditing) {
      console.log('toggle');
      this.setState(prevState => ({
        titleEditable: !prevState.titleEditable,
      }));
    }
  };

  onTitleChange = event => {
    console.log('change');
    this.setState({
      title: event.target.value,
    });
  };

  render() {
    const { isFullscreen, panel, dashboard } = this.props;
    const { titleEditable, title } = this.state;
    const isLoading = false;
    const panelHeaderClass = classNames({ 'panel-header': true, 'grid-drag-handle': !isFullscreen });

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
            {titleEditable ? (
              <input
                className="panel-title-input"
                onBlur={this.onToggleEditTitle}
                onChange={this.onTitleChange}
                type="text"
                value={title}
              />
            ) : (
              <span className="panel-title-text" onClick={this.onToggleEditTitle}>
                {title}
              </span>
            )}

            <span className="fa fa-caret-down panel-menu-toggle" data-toggle="dropdown" />

            <PanelHeaderMenu panel={panel} dashboard={dashboard} />

            <span className="panel-time-info">
              <i className="fa fa-clock-o" /> 4m
            </span>
          </div>
        </div>
      </div>
    );
  }
}
