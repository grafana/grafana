// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import AutoSizer from 'react-virtualized-auto-sizer';
import { connect, MapStateToProps, MapDispatchToProps } from 'react-redux';

// Components
import { PanelChrome } from './PanelChrome';
import { PanelEditor } from '../panel_editor/PanelEditor';
import { PanelResizer } from './PanelResizer';
import { PanelChromeAngular } from './PanelChromeAngular';

// Actions
import { initDashboardPanel } from '../state/actions';

// Types
import { PanelModel, DashboardModel } from '../state';
import { StoreState } from 'app/types';
import { PanelPlugin } from '@grafana/data';

export interface OwnProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  isEditing: boolean;
  isInEditMode?: boolean;
  isFullscreen: boolean;
  isInView: boolean;
}

export interface ConnectedProps {
  plugin?: PanelPlugin;
}

export interface DispatchProps {
  initDashboardPanel: typeof initDashboardPanel;
}

export type Props = OwnProps & ConnectedProps & DispatchProps;

export interface State {
  isLazy: boolean;
}

export class DashboardPanelUnconnected extends PureComponent<Props, State> {
  element: HTMLElement;
  specialPanels: { [key: string]: Function } = {};

  constructor(props: Props) {
    super(props);

    this.state = {
      isLazy: !props.isInView,
    };
  }

  componentDidMount() {
    this.props.initDashboardPanel(this.props.panel);
  }

  componentDidUpdate() {
    if (this.state.isLazy && this.props.isInView) {
      this.setState({ isLazy: false });
    }
  }

  onMouseEnter = () => {
    this.props.dashboard.setPanelFocus(this.props.panel.id);
  };

  onMouseLeave = () => {
    this.props.dashboard.setPanelFocus(0);
  };

  renderPanel(plugin: PanelPlugin) {
    const { dashboard, panel, isFullscreen, isInView, isInEditMode } = this.props;

    return (
      <AutoSizer>
        {({ width, height }) => {
          if (width === 0) {
            return null;
          }

          if (plugin.angularPanelCtrl) {
            return (
              <PanelChromeAngular
                plugin={plugin}
                panel={panel}
                dashboard={dashboard}
                isFullscreen={isFullscreen}
                isInView={isInView}
                width={width}
                height={height}
              />
            );
          }

          return (
            <PanelChrome
              plugin={plugin}
              panel={panel}
              dashboard={dashboard}
              isFullscreen={isFullscreen}
              isInView={isInView}
              isInEditMode={isInEditMode}
              width={width}
              height={height}
            />
          );
        }}
      </AutoSizer>
    );
  }

  render() {
    const { panel, dashboard, isFullscreen, isEditing, plugin } = this.props;
    const { isLazy } = this.state;

    // if we have not loaded plugin exports yet, wait
    if (!plugin) {
      return null;
    }

    // If we are lazy state don't render anything
    if (isLazy) {
      return null;
    }

    const editorContainerClasses = classNames({
      'panel-editor-container': isEditing,
      'panel-height-helper': !isEditing,
    });

    const panelWrapperClass = classNames({
      'panel-wrapper': true,
      'panel-wrapper--edit': isEditing,
      'panel-wrapper--view': isFullscreen && !isEditing,
    });

    return (
      <div className={editorContainerClasses}>
        <PanelResizer
          isEditing={isEditing}
          panel={panel}
          render={styles => (
            <div
              className={panelWrapperClass}
              onMouseEnter={this.onMouseEnter}
              onMouseLeave={this.onMouseLeave}
              style={styles}
            >
              {this.renderPanel(plugin)}
            </div>
          )}
        />
        {panel.isEditing && <PanelEditor panel={panel} plugin={plugin} dashboard={dashboard} />}
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, props) => {
  const panelState = state.dashboard.panels[props.panel.id];
  if (!panelState) {
    return { plugin: null };
  }

  return {
    plugin: panelState.plugin,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = { initDashboardPanel };

export const DashboardPanel = connect(mapStateToProps, mapDispatchToProps)(DashboardPanelUnconnected);
