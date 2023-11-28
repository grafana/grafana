// Libraries
import React, { PureComponent } from 'react';
// Types
import { PanelPlugin, PluginType } from '@grafana/data';
import { Alert } from '@grafana/ui';
import { AppNotificationSeverity } from 'app/types';
class PanelPluginError extends PureComponent {
    constructor(props) {
        super(props);
    }
    render() {
        const style = {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
        };
        return (React.createElement("div", { style: style },
            React.createElement(Alert, Object.assign({ severity: AppNotificationSeverity.Error }, this.props))));
    }
}
export function getPanelPluginLoadError(meta, err) {
    const LoadError = class LoadError extends PureComponent {
        render() {
            const text = (React.createElement(React.Fragment, null,
                "Check the server startup logs for more information. ",
                React.createElement("br", null),
                "If this plugin was loaded from Git, then make sure it was compiled."));
            return React.createElement(PanelPluginError, { title: `Error loading: ${meta.id}`, text: text });
        }
    };
    const plugin = new PanelPlugin(LoadError);
    plugin.meta = meta;
    plugin.loadError = true;
    return plugin;
}
export function getPanelPluginNotFound(id, silent) {
    const NotFound = class NotFound extends PureComponent {
        render() {
            return React.createElement(PanelPluginError, { title: `Panel plugin not found: ${id}` });
        }
    };
    const plugin = new PanelPlugin(silent ? () => null : NotFound);
    plugin.meta = {
        id: id,
        name: id,
        sort: 100,
        type: PluginType.panel,
        module: '',
        baseUrl: '',
        info: {
            author: {
                name: '',
            },
            description: '',
            links: [],
            logos: {
                large: '',
                small: 'public/img/grafana_icon.svg',
            },
            screenshots: [],
            updated: '',
            version: '',
        },
    };
    return plugin;
}
//# sourceMappingURL=PanelPluginError.js.map