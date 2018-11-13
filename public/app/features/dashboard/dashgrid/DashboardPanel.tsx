import React, { PureComponent } from 'react';
import config from 'app/core/config';

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
}

export class DashboardPanel extends PureComponent<Props, State> {
  element: any;
  angularPanel: AngularComponent;
  specialPanels = {};

  constructor(props) {
    super(props);

    this.state = {
      plugin: null,
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
    this.props.panel.changeType(plugin.id);
    this.loadPlugin();
  };

  onAngularPluginTypeChanged = () => {
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
    this.loadPlugin();

    // handle angular plugin loading
    if (!this.element || this.angularPanel) {
      return;
    }

    const loader = getAngularLoader();
    const template = '<plugin-component type="panel" class="panel-height-helper"></plugin-component>';
    const scopeProps = { panel: this.props.panel, dashboard: this.props.dashboard };
    this.angularPanel = loader.load(this.element, scopeProps, template);
  }

  cleanUpAngularPanel() {
    if (this.angularPanel) {
      this.angularPanel.destroy();
      this.angularPanel = null;
    }
  }

  componentWillUnmount() {
    this.cleanUpAngularPanel();
  }

  renderReactPanel() {
    const { dashboard, panel } = this.props;
    const { plugin } = this.state;

    const containerClass = this.props.isEditing ? 'panel-editor-container' : 'panel-height-helper';
    const panelWrapperClass = this.props.isEditing ? 'panel-editor-container__panel' : 'panel-height-helper';
    // this might look strange with these classes that change when edit, but
    // I want to try to keep markup (parents) for panel the same in edit mode to avoide unmount / new mount of panel
    return (
      <div className={containerClass}>
        <div className={panelWrapperClass}>
          <PanelChrome component={plugin.exports.Panel} panel={panel} dashboard={dashboard} />
        </div>
        {panel.isEditing && (
          <PanelEditor panel={panel} plugin={plugin} dashboard={dashboard} onTypeChanged={this.onPluginTypeChanged} />
        )}
      </div>
    );
  }

  render() {
    const { panel } = this.props;
    const { plugin } = this.state;

    if (this.isSpecial()) {
      return this.specialPanels[panel.type]();
    }

    // if we have not loaded plugin exports yet, wait
    if (!plugin || !plugin.exports) {
      return null;
    }

    // if exporting PanelComponent it must be a react panel
    if (plugin.exports.Panel) {
      return this.renderReactPanel();
    }

    // legacy angular rendering
    return <div ref={element => (this.element = element)} className="panel-height-helper" />;
  }
}
