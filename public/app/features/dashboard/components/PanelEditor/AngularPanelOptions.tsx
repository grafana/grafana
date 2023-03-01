import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { PanelPlugin, PanelPluginMeta } from '@grafana/data';
import { AngularComponent, getAngularLoader } from '@grafana/runtime';
import { PanelCtrl } from 'app/angular/panel/panel_ctrl';
import { changePanelPlugin } from 'app/features/panel/state/actions';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
import { StoreState } from 'app/types';

import { PanelModel, DashboardModel } from '../../state';

import { getSectionOpenState, saveSectionOpenState } from './state/utils';

interface OwnProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
}

const mapStateToProps = (state: StoreState, props: OwnProps) => ({
  angularPanelComponent: getPanelStateForModel(state, props.panel)?.angularComponent,
});

const mapDispatchToProps = { changePanelPlugin };

const connector = connect(mapStateToProps, mapDispatchToProps);
type Props = ConnectedProps<typeof connector> & OwnProps;

export class AngularPanelOptionsUnconnected extends PureComponent<Props> {
  element?: HTMLElement | null;
  angularOptions?: AngularComponent | null;

  constructor(props: Props) {
    super(props);
  }

  componentDidMount() {
    this.loadAngularOptions();
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.plugin !== prevProps.plugin ||
      this.props.angularPanelComponent !== prevProps.angularPanelComponent
    ) {
      this.cleanUpAngularOptions();
    }

    this.loadAngularOptions();
  }

  componentWillUnmount() {
    this.cleanUpAngularOptions();
  }

  cleanUpAngularOptions() {
    if (this.angularOptions) {
      this.angularOptions.destroy();
      this.angularOptions = null;
    }
  }

  loadAngularOptions() {
    const { panel, angularPanelComponent, changePanelPlugin } = this.props;

    if (!this.element || !angularPanelComponent || this.angularOptions) {
      return;
    }

    const scope = angularPanelComponent.getScope();

    // When full page reloading in edit mode the angular panel has on fully compiled and instantiated yet
    if (!scope.$$childHead) {
      setTimeout(() => {
        this.forceUpdate();
      });
      return;
    }

    const panelCtrl: PanelCtrl = scope.$$childHead.ctrl;
    panelCtrl.initEditMode();
    panelCtrl.onPluginTypeChange = (plugin: PanelPluginMeta) => {
      changePanelPlugin({ panel, pluginId: plugin.id });
    };

    let template = '';
    for (let i = 0; i < panelCtrl.editorTabs.length; i++) {
      const tab = panelCtrl.editorTabs[i];
      tab.isOpen = getSectionOpenState(tab.title, i === 0);

      template += `
      <div class="panel-options-group" ng-cloak>
        <div class="panel-options-group__header" ng-click="toggleOptionGroup(${i})" aria-label="${tab.title} section">
          <div class="panel-options-group__icon">
            <icon name="ctrl.editorTabs[${i}].isOpen ? 'angle-down' : 'angle-right'"></icon>
          </div>
          <div class="panel-options-group__title">${tab.title}</div>
        </div>
        <div class="panel-options-group__body" ng-if="ctrl.editorTabs[${i}].isOpen">
          <panel-editor-tab editor-tab="ctrl.editorTabs[${i}]" ctrl="ctrl"></panel-editor-tab>
        </div>
      </div>
      `;
    }

    const loader = getAngularLoader();
    const scopeProps = {
      ctrl: panelCtrl,
      toggleOptionGroup: (index: number) => {
        const tab = panelCtrl.editorTabs[index];
        tab.isOpen = !tab.isOpen;
        saveSectionOpenState(tab.title, Boolean(tab.isOpen));
      },
    };

    this.angularOptions = loader.load(this.element, scopeProps, template);
    this.angularOptions.digest();
  }

  render() {
    return <div ref={(elem) => (this.element = elem)} />;
  }
}

export const AngularPanelOptions = connect(mapStateToProps, mapDispatchToProps)(AngularPanelOptionsUnconnected);
