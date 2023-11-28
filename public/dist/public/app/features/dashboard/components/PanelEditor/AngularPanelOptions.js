import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { getAngularLoader } from '@grafana/runtime';
import { changePanelPlugin } from 'app/features/panel/state/actions';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
import { getSectionOpenState, saveSectionOpenState } from './state/utils';
const mapStateToProps = (state, props) => {
    var _a;
    return ({
        angularPanelComponent: (_a = getPanelStateForModel(state, props.panel)) === null || _a === void 0 ? void 0 : _a.angularComponent,
    });
};
const mapDispatchToProps = { changePanelPlugin };
const connector = connect(mapStateToProps, mapDispatchToProps);
export class AngularPanelOptionsUnconnected extends PureComponent {
    constructor(props) {
        super(props);
    }
    componentDidMount() {
        this.loadAngularOptions();
    }
    componentDidUpdate(prevProps) {
        if (this.props.plugin !== prevProps.plugin ||
            this.props.angularPanelComponent !== prevProps.angularPanelComponent) {
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
        const panelCtrl = scope.$$childHead.ctrl;
        panelCtrl.initEditMode();
        panelCtrl.onPluginTypeChange = (plugin) => {
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
            toggleOptionGroup: (index) => {
                const tab = panelCtrl.editorTabs[index];
                tab.isOpen = !tab.isOpen;
                saveSectionOpenState(tab.title, Boolean(tab.isOpen));
            },
        };
        this.angularOptions = loader.load(this.element, scopeProps, template);
        this.angularOptions.digest();
    }
    render() {
        return React.createElement("div", { ref: (elem) => (this.element = elem) });
    }
}
export const AngularPanelOptions = connect(mapStateToProps, mapDispatchToProps)(AngularPanelOptionsUnconnected);
//# sourceMappingURL=AngularPanelOptions.js.map