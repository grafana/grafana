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

import 'intersection-observer';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  isEditing: boolean;
  isFullscreen: boolean;
}

export interface State {
  plugin: PanelPlugin;
  angularPanel: AngularComponent;
  inView: boolean; // Is the dashboard is within the browser window
  load: boolean; // For lazy loading
}

export class DashboardPanel extends PureComponent<Props, State> {
  element: HTMLElement;
  specialPanels = {};
  observer: IntersectionObserver;
  watching: HTMLElement;

  constructor(props) {
    super(props);

    this.state = {
      plugin: null,
      angularPanel: null,
      inView: false,
      load: false,
    };

    this.specialPanels['row'] = this.renderRow.bind(this);
    this.specialPanels['add-panel'] = this.renderAddPanel.bind(this);

    // Check if the panel is within the browser viewport
    this.observer = new IntersectionObserver(this.callback.bind(this), {
      root: null, // the viewport
      rootMargin: '250px', // buffer by 250
      threshold: 0, // any pixel
    });
  }

  private watch(e: HTMLElement) {
    if (e && e !== this.watching) {
      if (this.watching) {
        this.observer.unobserve(this.watching);
      }
      this.observer.observe(e);
      this.watching = e;
    }
  }

  private callback(entries: IntersectionObserverEntry[]) {
    // Fast scrolling can send multiple callbacks quickly
    // !intersecting => intersecting => !intersecting in one callback.
    const vis = entries[entries.length-1].isIntersecting;
    if (vis !== this.state.inView) {
      this.setState( {inView: vis} );
      if (vis) {
        this.setState( {load: true} );
      }
    }
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
    this.observer.disconnect();
  }

  onMouseEnter = () => {
    this.props.dashboard.setPanelFocus(this.props.panel.id);
  };

  onMouseLeave = () => {
    this.props.dashboard.setPanelFocus(0);
  };

  renderReactPanel() {
    const { dashboard, panel } = this.props;
    const { plugin, inView } = this.state;

    return <PanelChrome plugin={plugin} panel={panel} dashboard={dashboard} inView={inView} />;
  }

  renderAngularPanel() {
    return <div ref={element => (this.element = element)} className="panel-height-helper" />;
  }

  render() {
    const { panel, dashboard, isFullscreen, isEditing } = this.props;
    const { plugin, angularPanel, load } = this.state;

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
      <div className={containerClass} ref={ e => this.watch(e) }>
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
              {load && plugin.exports.Panel && this.renderReactPanel()}
              {load && plugin.exports.PanelCtrl && this.renderAngularPanel()}
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
