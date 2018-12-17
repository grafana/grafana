import React, { PureComponent } from 'react';
import config from 'app/core/config';
import classNames from 'classnames';

import { getAngularLoader, AngularComponent, AngularLoader } from 'app/core/services/AngularLoader';
import { importPluginModule } from 'app/features/plugins/plugin_loader';

import { AddPanelPanel } from './AddPanelPanel';
import { getPanelPluginNotFound } from './PanelPluginNotFound';
import { DashboardRow } from './DashboardRow';
import { PanelChrome } from './PanelChrome';
import { PanelEditor } from './PanelEditor';

import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { PanelPlugin } from 'app/types';
import { ResizableBox } from 'react-resizable';
import { debounce } from 'lodash';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  isEditing: boolean;
  isFullscreen: boolean;
}

interface DimensionsXY {
  x: number;
  y: number;
}

export interface State {
  plugin: PanelPlugin;
  angularPanel: AngularComponent;
  panelDimensions: DimensionsXY;
}

export class DashboardPanel extends PureComponent<Props, State> {
  element: HTMLElement;
  specialPanels = {};
  debouncedUpdatePanelDimensions: () => void;
  debouncedResizeDone: () => void;
  angularLoader: AngularLoader = getAngularLoader();

  constructor(props) {
    super(props);
    this.state = {
      plugin: null,
      angularPanel: null,
      panelDimensions: this.screenDimensions,
    };

    this.specialPanels['row'] = this.renderRow.bind(this);
    this.specialPanels['add-panel'] = this.renderAddPanel.bind(this);
    this.debouncedUpdatePanelDimensions = debounce(this.updatePanelDimensions, 100);
    this.debouncedResizeDone = debounce(() => {
      this.props.panel.resizeDone();
    }, 100);
  }

  isSpecial(pluginId: string) {
    return this.specialPanels[pluginId];
  }

  renderRow() {
    return <DashboardRow panel={this.props.panel} dashboard={this.props.dashboard} />;
  }

  renderAddPanel() {
    return <AddPanelPanel panel={this.props.panel} dashboard={this.props.dashboard} />;
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
      const plugin = config.panels[pluginId] || getPanelPluginNotFound(pluginId);

      // remember if this is from an angular panel
      const fromAngularPanel = this.state.angularPanel != null;

      // unmount angular panel
      this.cleanUpAngularPanel();

      if (panel.type !== pluginId) {
        this.props.panel.changeType(pluginId, fromAngularPanel);
      }

      if (plugin.exports) {
        this.setState({ plugin: plugin, angularPanel: null });
      } else {
        plugin.exports = await importPluginModule(plugin.module);
        this.setState({ plugin: plugin, angularPanel: null });
      }
    }
  }

  get screenDimensions(): DimensionsXY {
    return {
      x: document.documentElement.scrollWidth,
      y: Math.floor(document.documentElement.scrollHeight * 0.4),
    };
  }

  updatePanelDimensions = () => {
    this.setState({
      panelDimensions: this.screenDimensions,
    });
  };

  componentDidMount() {
    this.loadPlugin(this.props.panel.type);
    window.addEventListener('resize', this.debouncedUpdatePanelDimensions);
  }

  componentDidUpdate() {
    if (!this.element || this.element.innerHTML !== '') {
      return;
    }

    if (this.state.angularPanel && this.state.angularPanel.destroy) {
      this.state.angularPanel.destroy();
    }
    const template = '<plugin-component type="panel" class="panel-height-helper"></plugin-component>';
    const scopeProps = { panel: this.props.panel, dashboard: this.props.dashboard };
    const angularPanel = this.angularLoader.load(this.element, scopeProps, template);
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
    window.removeEventListener('resize', this.debouncedUpdatePanelDimensions);
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

  renderPanel = (plugin: PanelPlugin) => (
    <>
      {plugin.exports.Panel && this.renderReactPanel()}
      {plugin.exports.PanelCtrl && this.renderAngularPanel()}
    </>
  );

  renderEditingPanelBox = (panelContent: JSX.Element, panelWrapperClass: string) => {
    const { x, y } = this.state.panelDimensions;
    const panelBox = this.renderPanelBox(panelContent, panelWrapperClass);
    return (
      <ResizableBox height={y} width={x} axis="y" onResize={this.debouncedResizeDone}>
        {panelBox}
      </ResizableBox>
    );
  };

  renderPanelBox = (panelContent: JSX.Element, panelWrapperClass: string) => {
    return (
      <div className={panelWrapperClass} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
        {panelContent}
      </div>
    );
  };

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

    const panelContent = this.renderPanel(plugin);
    console.log('DashboardPanel:render');
    return (
      <div className={containerClass}>
        {isEditing
          ? this.renderEditingPanelBox(panelContent, panelWrapperClass)
          : this.renderPanelBox(panelContent, panelWrapperClass)}

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
