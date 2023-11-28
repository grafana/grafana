import { cloneDeep } from 'lodash';
import React, { PureComponent } from 'react';
import { getAngularLoader } from '@grafana/runtime';
export class DataSourcePluginSettings extends PureComponent {
    constructor(props) {
        super(props);
        this.element = null;
        this.onModelChanged = (dataSource) => {
            this.props.onModelChange(dataSource);
        };
        this.scopeProps = {
            ctrl: { datasourceMeta: props.dataSourceMeta, current: cloneDeep(props.dataSource) },
            onModelChanged: this.onModelChanged,
        };
        this.onModelChanged = this.onModelChanged.bind(this);
    }
    componentDidMount() {
        const { plugin } = this.props;
        if (!this.element) {
            return;
        }
        if (!plugin.components.ConfigEditor) {
            // React editor is not specified, let's render angular editor
            // How to approach this better? Introduce ReactDataSourcePlugin interface and typeguard it here?
            const loader = getAngularLoader();
            const template = '<plugin-component type="datasource-config-ctrl" />';
            this.component = loader.load(this.element, this.scopeProps, template);
        }
    }
    componentDidUpdate(prevProps) {
        var _a;
        const { plugin } = this.props;
        if (!plugin.components.ConfigEditor && this.props.dataSource !== prevProps.dataSource) {
            this.scopeProps.ctrl.current = cloneDeep(this.props.dataSource);
            (_a = this.component) === null || _a === void 0 ? void 0 : _a.digest();
        }
    }
    componentWillUnmount() {
        if (this.component) {
            this.component.destroy();
        }
    }
    render() {
        const { plugin, dataSource } = this.props;
        if (!plugin) {
            return null;
        }
        return (React.createElement("div", { ref: (element) => (this.element = element) }, plugin.components.ConfigEditor &&
            React.createElement(plugin.components.ConfigEditor, {
                options: dataSource,
                onOptionsChange: this.onModelChanged,
            })));
    }
}
//# sourceMappingURL=DataSourcePluginSettings.js.map