import React, { PureComponent } from 'react';
import config from 'app/core/config';
import classNames from 'classnames';

import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import { importPluginModule } from 'app/features/plugins/plugin_loader';

import { AddPanelPanel } from './AddPanelPanel';
import { getPanelPluginNotFound } from './PanelPluginNotFound';
import { DashboardRow } from './DashboardRow';
import { PanelChrome } from './PanelChrome';
import { PanelEditor } from './PanelEditor';

import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { PanelPlugin } from 'app/types';

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

  isSpecial() {
    return this.specialPanels[this.props.panel.type];
  }

  renderRow() {
    return <DashboardRow panel={this.props.panel} dashboard={this.props.dashboard} />;
  }

  renderAddPanel() {
    return <AddPanelPanel panel={this.props.panel} dashboard={this.props.dashboard} />;
  }

  onPluginTypeChanged = (plugin: PanelPlugin) => {
    this.props.panel.changeType(plugin.id, this.state.angularPanel !== null);
    this.loadPlugin();
  };

  loadPlugin() {
    if (this.isSpecial()) {
      return;
    }

    const { panel } = this.props;

    // handle plugin loading & changing of plugin type
    if (!this.state.plugin || this.state.plugin.id !== panel.type) {
      const plugin = config.panels[panel.type] || getPanelPluginNotFound(panel.type);

      if (plugin.exports) {
        this.cleanUpAngularPanel();
        this.setState({ plugin: plugin });
      } else {
        importPluginModule(plugin.module).then(pluginExports => {
          this.cleanUpAngularPanel();
          // cache plugin exports (saves a promise async cycle next time)
          plugin.exports = pluginExports;
          // update panel state
          this.setState({ plugin: plugin });
        });
      }
    }
  }

  componentDidMount() {
    this.loadPlugin();
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

  cleanUpAngularPanel(unmounted?: boolean) {
    if (this.state.angularPanel) {
      this.state.angularPanel.destroy();

      if (!unmounted) {
        this.setState({ angularPanel: null });
      }
    }
  }

  componentWillUnmount() {
    this.cleanUpAngularPanel(true);
  }

  onMouseEnter = () => {
    this.props.dashboard.setPanelFocus(this.props.panel.id);
  };

  onMouseLeave = () => {
    this.props.dashboard.setPanelFocus(0);
  };

  renderReactPanel() {
    const { dashboard, panel } = this.props;
    const { plugin } = this.state;

    return <PanelChrome plugin={plugin} panel={panel} dashboard={dashboard} />;
  }

  renderAngularPanel() {
    return <div ref={element => (this.element = element)} className="panel-height-helper" />;
  }

  render() {
    const { panel, dashboard, isFullscreen, isEditing } = this.props;
    const { plugin, angularPanel } = this.state;

    if (this.isSpecial()) {
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
        <div className={panelWrapperClass} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
          {plugin.exports.Panel && this.renderReactPanel()}
          {plugin.exports.PanelCtrl && this.renderAngularPanel()}
        </div>
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
