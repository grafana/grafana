import React from 'react';
import config from 'app/core/config';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import { DashboardRow } from './DashboardRow';
import { AddPanelPanel } from './AddPanelPanel';
import { importPluginModule } from 'app/features/plugins/plugin_loader';
import { PluginExports, PanelPlugin } from 'app/types/plugins';
import { PanelChrome } from './PanelChrome';
import { PanelEditor } from './PanelEditor';

export interface Props {
  panelType: string;
  panel: PanelModel;
  dashboard: DashboardModel;
}

export interface State {
  pluginExports: PluginExports;
}

export class DashboardPanel extends React.Component<Props, State> {
  element: any;
  angularPanel: AngularComponent;
  pluginInfo: any;
  specialPanels = {};

  constructor(props) {
    super(props);

    this.state = {
      pluginExports: null,
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

    // handle plugin loading & changing of plugin type
    if (!this.pluginInfo || this.pluginInfo.id !== this.props.panel.type) {
      this.pluginInfo = config.panels[this.props.panel.type];

      if (this.pluginInfo.exports) {
        this.cleanUpAngularPanel();
        this.setState({ pluginExports: this.pluginInfo.exports });
      } else {
        importPluginModule(this.pluginInfo.module).then(pluginExports => {
          this.cleanUpAngularPanel();
          // cache plugin exports (saves a promise async cycle next time)
          this.pluginInfo.exports = pluginExports;
          // update panel state
          this.setState({ pluginExports: pluginExports });
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
    const { pluginExports } = this.state;
    const containerClass = this.props.panel.isEditing ? 'panel-editor-container' : 'panel-height-helper';
    const panelWrapperClass = this.props.panel.isEditing ? 'panel-editor-container__panel' : 'panel-height-helper';

    // this might look strange with these classes that change when edit, but
    // I want to try to keep markup (parents) for panel the same in edit mode to avoide unmount / new mount of panel
    return (
      <div className={containerClass}>
        <div className={panelWrapperClass}>
          <PanelChrome
            component={pluginExports.PanelComponent}
            panel={this.props.panel}
            dashboard={this.props.dashboard}
          />
        </div>
        {this.props.panel.isEditing && (
          <div className="panel-editor-container__editor">
            <PanelEditor
              panel={this.props.panel}
              panelType={this.props.panel.type}
              dashboard={this.props.dashboard}
              onTypeChanged={this.onPluginTypeChanged}
              pluginExports={pluginExports}
            />
          </div>
        )}
      </div>
    );
  }

  render() {
    if (this.isSpecial()) {
      return this.specialPanels[this.props.panel.type]();
    }

    if (!this.state.pluginExports) {
      return null;
    }

    if (this.state.pluginExports.PanelComponent) {
      return this.renderReactPanel();
    }

    // legacy angular rendering
    return <div ref={element => (this.element = element)} className="panel-height-helper" />;
  }
}
