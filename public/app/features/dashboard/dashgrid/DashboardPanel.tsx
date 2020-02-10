// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import AutoSizer from 'react-virtualized-auto-sizer';

// Utils & Services
import { importPanelPlugin } from 'app/features/plugins/plugin_loader';

// Components
import { AddPanelWidget } from '../components/AddPanelWidget';
import { DashboardRow } from '../components/DashboardRow';
import { PanelChrome } from './PanelChrome';
import { PanelEditor } from '../panel_editor/PanelEditor';
import { PanelResizer } from './PanelResizer';
import { PanelChromeAngular } from './PanelChromeAngular';

// Types
import { PanelModel, DashboardModel } from '../state';
import { PanelPluginMeta, PanelPlugin } from '@grafana/data';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  isEditing: boolean;
  isInEditMode?: boolean;
  isFullscreen: boolean;
  isInView: boolean;
}

export interface State {
  plugin: PanelPlugin;
  isLazy: boolean;
}

export class DashboardPanel extends PureComponent<Props, State> {
  element: HTMLElement;
  specialPanels: { [key: string]: Function } = {};

  constructor(props: Props) {
    super(props);

    this.state = {
      plugin: null,
      isLazy: !props.isInView,
    };

    this.specialPanels['row'] = this.renderRow.bind(this);
    this.specialPanels['add-panel'] = this.renderAddPanel.bind(this);
  }

  isSpecial(pluginId: string) {
    return this.specialPanels[pluginId];
  }

  renderRow() {
    return <DashboardRow panel={this.props.panel} dashboard={this.props.dashboard} />;
  }

  renderAddPanel() {
    return <AddPanelWidget panel={this.props.panel} dashboard={this.props.dashboard} />;
  }

  onPluginTypeChange = (plugin: PanelPluginMeta) => {
    this.loadPlugin(plugin.id);
  };

  async loadPlugin(pluginId: string) {
    if (this.isSpecial(pluginId)) {
      return;
    }

    const { panel } = this.props;

    // handle plugin loading & changing of plugin type
    if (!this.state.plugin || this.state.plugin.meta.id !== pluginId) {
      const plugin = await importPanelPlugin(pluginId);

      if (panel.type !== pluginId) {
        panel.changePlugin(plugin);
      } else {
        panel.pluginLoaded(plugin);
      }

      this.setState({ plugin });
    }
  }

  componentDidMount() {
    this.loadPlugin(this.props.panel.type);
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
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

  renderPanel() {
    const { dashboard, panel, isFullscreen, isInView, isInEditMode } = this.props;
    const { plugin } = this.state;

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
    const { panel, dashboard, isFullscreen, isEditing } = this.props;
    const { plugin, isLazy } = this.state;

    if (this.isSpecial(panel.type)) {
      return this.specialPanels[panel.type]();
    }

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
              {this.renderPanel()}
            </div>
          )}
        />
        {panel.isEditing && (
          <PanelEditor
            panel={panel}
            plugin={plugin}
            dashboard={dashboard}
            onPluginTypeChange={this.onPluginTypeChange}
          />
        )}
      </div>
    );
  }
}
