import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { LiveChannelScope, } from '@grafana/data';
import { Select, Alert, Label, stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
const scopes = [
    { label: 'Grafana', value: LiveChannelScope.Grafana, description: 'Core grafana live features' },
    { label: 'Data Sources', value: LiveChannelScope.DataSource, description: 'Data sources with live support' },
    { label: 'Plugins', value: LiveChannelScope.Plugin, description: 'Plugins with live support' },
];
export class LiveChannelEditor extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            namespaces: [],
            paths: [],
        };
        this.onScopeChanged = (v) => {
            if (v.value) {
                this.props.onChange({
                    scope: v.value,
                    namespace: undefined,
                    path: undefined,
                });
            }
        };
        this.onNamespaceChanged = (v) => {
            var _a;
            this.props.onChange({
                scope: (_a = this.props.value) === null || _a === void 0 ? void 0 : _a.scope,
                namespace: v.value,
                path: undefined,
            });
        };
        this.onPathChanged = (v) => {
            const { value, onChange } = this.props;
            onChange({
                scope: value.scope,
                namespace: value.namespace,
                path: v.value,
            });
        };
    }
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            this.updateSelectOptions();
        });
    }
    componentDidUpdate(oldProps) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.props.value !== oldProps.value) {
                this.updateSelectOptions();
            }
        });
    }
    updateSelectOptions() {
        return __awaiter(this, void 0, void 0, function* () {
            this.setState({
                namespaces: [],
                paths: [],
            });
        });
    }
    render() {
        var _a;
        const { namespaces, paths } = this.state;
        const { scope, namespace, path } = this.props.value;
        const style = getStyles(config.theme2);
        return (React.createElement(React.Fragment, null,
            React.createElement(Alert, { title: "Grafana Live", severity: "info" }, "This supports real-time event streams in grafana core. This feature is under heavy development. Expect the intefaces and structures to change as this becomes more production ready."),
            React.createElement("div", null,
                React.createElement("div", { className: style.dropWrap },
                    React.createElement(Label, null, "Scope"),
                    React.createElement(Select, { options: scopes, value: scopes.find((s) => s.value === scope), onChange: this.onScopeChanged })),
                scope && (React.createElement("div", { className: style.dropWrap },
                    React.createElement(Label, null, "Namespace"),
                    React.createElement(Select, { options: namespaces, value: (_a = namespaces.find((s) => s.value === namespace)) !== null && _a !== void 0 ? _a : (namespace ? { label: namespace, value: namespace } : undefined), onChange: this.onNamespaceChanged, allowCustomValue: true, backspaceRemovesValue: true }))),
                scope && namespace && (React.createElement("div", { className: style.dropWrap },
                    React.createElement(Label, null, "Path"),
                    React.createElement(Select, { options: paths, value: findPathOption(paths, path), onChange: this.onPathChanged, allowCustomValue: true, backspaceRemovesValue: true }))))));
    }
}
function findPathOption(paths, path) {
    const v = paths.find((s) => s.value === path);
    if (v) {
        return v;
    }
    if (path) {
        return { label: path, value: path };
    }
    return undefined;
}
const getStyles = stylesFactory((theme) => ({
    dropWrap: css `
    margin-bottom: ${theme.spacing(1)};
  `,
}));
//# sourceMappingURL=LiveChannelEditor.js.map