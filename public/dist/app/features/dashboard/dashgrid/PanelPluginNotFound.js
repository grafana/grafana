import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
// Components
import { AlertBox } from 'app/core/components/AlertBox/AlertBox';
// Types
import { AppNotificationSeverity } from 'app/types';
import { ReactPanelPlugin } from '@grafana/ui';
var PanelPluginNotFound = /** @class */ (function (_super) {
    tslib_1.__extends(PanelPluginNotFound, _super);
    function PanelPluginNotFound(props) {
        return _super.call(this, props) || this;
    }
    PanelPluginNotFound.prototype.render = function () {
        var style = {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
        };
        return (React.createElement("div", { style: style },
            React.createElement(AlertBox, { severity: AppNotificationSeverity.Error, title: "Panel plugin not found: " + this.props.pluginId })));
    };
    return PanelPluginNotFound;
}(PureComponent));
export function getPanelPluginNotFound(id) {
    var NotFound = /** @class */ (function (_super) {
        tslib_1.__extends(NotFound, _super);
        function NotFound() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        NotFound.prototype.render = function () {
            return React.createElement(PanelPluginNotFound, { pluginId: id });
        };
        return NotFound;
    }(PureComponent));
    return {
        id: id,
        name: id,
        sort: 100,
        module: '',
        baseUrl: '',
        dataFormats: [],
        info: {
            author: {
                name: '',
            },
            description: '',
            links: [],
            logos: {
                large: '',
                small: '',
            },
            screenshots: [],
            updated: '',
            version: '',
        },
        exports: {
            reactPanel: new ReactPanelPlugin(NotFound),
        },
    };
}
//# sourceMappingURL=PanelPluginNotFound.js.map