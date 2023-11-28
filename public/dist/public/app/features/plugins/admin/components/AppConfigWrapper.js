// Libraries
import { css } from '@emotion/css';
import { cloneDeep, extend } from 'lodash';
import React, { PureComponent } from 'react';
import { deprecationWarning } from '@grafana/data';
import { getAngularLoader, getBackendSrv } from '@grafana/runtime';
import { Button } from '@grafana/ui';
export class AppConfigCtrlWrapper extends PureComponent {
    constructor(props) {
        super(props);
        this.element = null;
        // Needed for angular scope
        this.preUpdateHook = () => Promise.resolve();
        this.postUpdateHook = () => Promise.resolve();
        //-----------------------------------------------------------
        // Copied from plugin_edit_ctrl
        //-----------------------------------------------------------
        this.update = () => {
            const pluginId = this.model.id;
            this.preUpdateHook()
                .then(() => {
                const updateCmd = extend({
                    enabled: this.model.enabled,
                    pinned: this.model.pinned,
                    jsonData: this.model.jsonData,
                    secureJsonData: this.model.secureJsonData,
                }, {});
                return getBackendSrv().post(`/api/plugins/${pluginId}/settings`, updateCmd);
            })
                .then(this.postUpdateHook)
                .then((res) => {
                window.location.href = window.location.href;
            });
        };
        this.setPreUpdateHook = (callback) => {
            this.preUpdateHook = callback;
        };
        this.setPostUpdateHook = (callback) => {
            this.postUpdateHook = callback;
        };
        // Stub to avoid unknown function in legacy code
        this.importDashboards = () => {
            deprecationWarning('AppConfig', 'importDashboards()');
            return Promise.resolve();
        };
        this.enable = () => {
            this.model.enabled = true;
            this.model.pinned = true;
            this.update();
        };
        this.disable = () => {
            this.model.enabled = false;
            this.model.pinned = false;
            this.update();
        };
        this.state = {
            angularCtrl: null,
            refresh: 0,
        };
    }
    componentDidMount() {
        // Force a reload after the first mount -- is there a better way to do this?
        setTimeout(() => {
            this.setState({ refresh: this.state.refresh + 1 });
        }, 5);
    }
    componentDidUpdate(prevProps) {
        if (!this.element || this.state.angularCtrl) {
            return;
        }
        // Set a copy of the meta
        this.model = cloneDeep(this.props.app.meta);
        const loader = getAngularLoader();
        const template = '<plugin-component type="app-config-ctrl"></plugin-component>';
        const scopeProps = {
            ctrl: this,
            // used by angular injectorMonkeyPatch to detect this scenario
            isAppConfigCtrl: true,
        };
        const angularCtrl = loader.load(this.element, scopeProps, template);
        this.setState({ angularCtrl });
    }
    render() {
        const model = this.model;
        const withRightMargin = css({ marginRight: '8px' });
        return (React.createElement("div", null,
            React.createElement("div", { ref: (element) => (this.element = element) }),
            React.createElement("br", null),
            React.createElement("br", null),
            model && (React.createElement("div", { className: "gf-form" },
                !model.enabled && (React.createElement(Button, { variant: "primary", onClick: this.enable, className: withRightMargin }, "Enable")),
                model.enabled && (React.createElement(Button, { variant: "primary", onClick: this.update, className: withRightMargin }, "Update")),
                model.enabled && (React.createElement(Button, { variant: "destructive", onClick: this.disable, className: withRightMargin }, "Disable"))))));
    }
}
//# sourceMappingURL=AppConfigWrapper.js.map