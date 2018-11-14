import React, { PureComponent } from 'react';
import classNames from 'classnames';

import { PanelHeaderMenu } from './PanelHeaderMenu';

import { DashboardModel } from 'app/features/dashboard/dashboard_model';
import { PanelModel } from 'app/features/dashboard/panel_model';
import { ClickOutsideWrapper } from 'app/core/components/ClickOutsideWrapper/ClickOutsideWrapper';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  isEditing: boolean;
  isFullscreen: boolean;
  timeInfo: string;
}

export interface State {
  title: string;
  titleEditable: boolean;
  panelMenuOpen: boolean;
}

export class PanelHeader extends PureComponent<Props, State> {
  dropdownToggleElement: HTMLElement;
  titleInputElement: HTMLElement;

  constructor(props) {
    super(props);

    this.state = {
      title: props.panel.title,
      titleEditable: false,
      panelMenuOpen: false,
    };
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (!prevState.titleEditable && this.titleInputElement) {
      this.titleInputElement.focus();
    }
  }

  onToggleEditTitle = event => {
    if (this.props.isEditing) {
      event.stopPropagation();

      this.setState(
        prevState => ({
          titleEditable: !prevState.titleEditable,
        }),
        () => {
          this.props.panel.updateTitle(this.state.title);
        }
      );
    }
  };

  onTitleChange = event => {
    this.setState({
      title: event.target.value,
    });
  };

  onMenuToggle = event => {
    event.stopPropagation();

    this.setState(prevState => ({
      panelMenuOpen: !prevState.panelMenuOpen,
    }));
  };

  closeMenu = () => {
    this.setState({
      panelMenuOpen: false,
    });
  };

  render() {
    const { isFullscreen, panel, dashboard, timeInfo } = this.props;
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

        <div className="panel-title-container" onClick={this.onMenuToggle}>
          <div className="panel-title">
            <span className="icon-gf panel-alert-icon" />
            {titleEditable ? (
              <input
                ref={element => (this.titleInputElement = element)}
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

            <span
              className="fa fa-caret-down panel-menu-toggle"
              data-toggle="dropdown"
              ref={element => (this.dropdownToggleElement = element)}
            />

            {this.state.panelMenuOpen && (
              <ClickOutsideWrapper onClick={this.closeMenu}>
                <PanelHeaderMenu panel={panel} dashboard={dashboard} />
              </ClickOutsideWrapper>
            )}

            {timeInfo && (
              <span className="panel-time-info">
                <i className="fa fa-clock-o" /> {timeInfo}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
}
