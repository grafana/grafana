// Libraries
import React, { PureComponent } from 'react';
// Utils & Services
import { AngularComponent, getAngularLoader } from '@grafana/runtime';
// Types
import { PanelModel, DashboardModel } from '../state';
import { angularPanelUpdated } from '../state/PanelModel';
import { PanelPlugin, PanelPluginMeta } from '@grafana/data';
import { PanelCtrl } from 'app/plugins/sdk';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  onPluginTypeChange: (newType: PanelPluginMeta) => void;
}

export class AngularPanelOptions extends PureComponent<Props> {
  element?: HTMLElement;
  angularOptions: AngularComponent;

  constructor(props: Props) {
    super(props);
  }

  componentDidMount() {
    this.loadAngularOptions();
    this.props.panel.events.on(angularPanelUpdated, this.onAngularPanelUpdated);
  }

  onAngularPanelUpdated = () => {
    this.forceUpdate();
  };

  componentDidUpdate(prevProps: Props) {
    if (this.props.plugin !== prevProps.plugin) {
      this.cleanUpAngularOptions();
    }

    this.loadAngularOptions();
  }

  componentWillUnmount() {
    this.cleanUpAngularOptions();
    this.props.panel.events.off(angularPanelUpdated, this.onAngularPanelUpdated);
  }

  cleanUpAngularOptions() {
    if (this.angularOptions) {
      this.angularOptions.destroy();
      this.angularOptions = null;
    }
  }

  loadAngularOptions() {
    const { panel } = this.props;

    if (!this.element || !panel.angularPanel || this.angularOptions) {
      return;
    }

    const scope = panel.angularPanel.getScope();

    // When full page reloading in edit mode the angular panel has on fully compiled & instantiated yet
    if (!scope.$$childHead) {
      setTimeout(() => {
        this.forceUpdate();
      });
      return;
    }

    const panelCtrl: PanelCtrl = scope.$$childHead.ctrl;
    panelCtrl.initEditMode();
    panelCtrl.onPluginTypeChange = this.props.onPluginTypeChange;

    let template = '';
    for (let i = 0; i < panelCtrl.editorTabs.length; i++) {
      template +=
        `
      <div class="panel-options-group" ng-cloak>` +
        (i > 0
          ? `<div class="panel-options-group__header">
           <span class="panel-options-group__title">{{ctrl.editorTabs[${i}].title}}
           </span>
         </div>`
          : '') +
        `<div class="panel-options-group__body">
          <panel-editor-tab editor-tab="ctrl.editorTabs[${i}]" ctrl="ctrl"></panel-editor-tab>
        </div>
      </div>
      `;
    }

    const loader = getAngularLoader();
    const scopeProps = { ctrl: panelCtrl };

    this.angularOptions = loader.load(this.element, scopeProps, template);
  }

  render() {
    return <div ref={elem => (this.element = elem)} />;
  }
}
