import React, { PureComponent } from 'react';
import config from 'app/core/config';
import classNames from 'classnames';

import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import { importPluginModule } from 'app/features/plugins/plugin_loader';

import { AddPanelWidget } from '../components/AddPanelWidget';
import { getPanelPluginNotFound } from './PanelPluginNotFound';
import { DashboardRow } from '../components/DashboardRow';
import { PanelChrome } from './PanelChrome';
import { PanelEditor } from '../panel_editor/PanelEditor';

import { PanelModel, DashboardModel } from '../state';
import { PanelPlugin } from 'app/types';
import { PanelResizer } from './PanelResizer';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  isEditing: boolean;
  isFullscreen: boolean;
}

export interface State {
  plugin: PanelPlugin;
  angularPanel: AngularComponent;
}

export class DashboardPanel extends PureComponent<Props, State> {
  element: HTMLElement;
  specialPanels = {};

  constructor(props) {
    super(props);

    this.state = {
      plugin: null,
      angularPanel: null,
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

  onPluginTypeChanged = (plugin: PanelPlugin) => {
    this.loadPlugin(plugin.id);
  };

  async loadPlugin(pluginId: string) {
    if (this.isSpecial(pluginId)) {
      return;
    }

    const { panel } = this.props;

    // handle plugin loading & changing of plugin type
    if (!this.state.plugin || this.state.plugin.id !== pluginId) {
      let plugin = config.panels[pluginId] || getPanelPluginNotFound(pluginId);

      // unmount angular panel
      this.cleanUpAngularPanel();

      if (!plugin.exports) {
        try {
          plugin.exports = await importPluginModule(plugin.module);
        } catch (e) {
          plugin = getPanelPluginNotFound(pluginId);
        }
      }

      if (panel.type !== pluginId) {
        panel.changePlugin(plugin);
      } else {
        panel.pluginLoaded(plugin);
      }

      this.setState({ plugin, angularPanel: null });
    }
  }

  componentDidMount() {
    this.loadPlugin(this.props.panel.type);
  }

  componentDidUpdate() {
    if (!this.element || this.state.angularPanel) {
      return;
    }

    const loader = getAngularLoader();
    const template = '<plugin-component type="panel" class="panel-height-helper"></plugin-component>';
    const scopeProps = { panel: this.props.panel, dashboard: this.props.dashboard };
    const angularPanel = loader.load(this.element, scopeProps, template);

    this.setState({ angularPanel });
  }

  cleanUpAngularPanel() {
    if (this.state.angularPanel) {
      this.state.angularPanel.destroy();
      this.element = null;
    }
  }

  componentWillUnmount() {
    this.cleanUpAngularPanel();
  }

  onMouseEnter = () => {
    this.props.dashboard.setPanelFocus(this.props.panel.id);
  };

  onMouseLeave = () => {
    this.props.dashboard.setPanelFocus(0);
  };

  renderReactPanel() {
    const { dashboard, panel, isFullscreen } = this.props;
    const { plugin } = this.state;

    return <PanelChrome plugin={plugin} panel={panel} dashboard={dashboard} isFullscreen={isFullscreen} />;
  }

  renderAngularPanel() {
    return <div ref={element => (this.element = element)} className="panel-height-helper" />;
  }

  render() {
    const { panel, dashboard, isFullscreen, isEditing } = this.props;
    const { plugin, angularPanel } = this.state;

    if (this.isSpecial(panel.type)) {
      return this.specialPanels[panel.type]();
    }

    // if we have not loaded plugin exports yet, wait
    if (!plugin || !plugin.exports) {
      return null;
    }

    const containerClass = classNames({ 'panel-editor-container': isEditing, 'panel-height-helper': !isEditing });
    const panelWrapperClass = classNames({
      'panel-wrapper': true,
      'panel-wrapper--edit': isEditing,
      'panel-wrapper--view': isFullscreen && !isEditing,
    });

    return (
      <div className={containerClass}>
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
              {plugin.exports.reactPanel && this.renderReactPanel()}
              {plugin.exports.PanelCtrl && this.renderAngularPanel()}
            </div>
          )}
        />
        {panel.isEditing && (
          <PanelEditor
            panel={panel}
            plugin={plugin}
            dashboard={dashboard}
            angularPanel={angularPanel}
            onTypeChanged={this.onPluginTypeChanged}
          />
        )}
      </div>
    );
  }
}
