import { __assign, __extends } from "tslib";
import React, { Component } from 'react';
import { DebugMode } from './types';
import { EventBusLoggerPanel } from './EventBusLogger';
import { RenderInfoViewer } from './RenderInfoViewer';
import { CursorView } from './CursorView';
import { StateView } from './StateView';
var DebugPanel = /** @class */ (function (_super) {
    __extends(DebugPanel, _super);
    function DebugPanel() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DebugPanel.prototype.render = function () {
        var options = this.props.options;
        switch (options.mode) {
            case DebugMode.Events:
                return React.createElement(EventBusLoggerPanel, { eventBus: this.props.eventBus });
            case DebugMode.Cursor:
                return React.createElement(CursorView, { eventBus: this.props.eventBus });
            case DebugMode.State:
                return React.createElement(StateView, __assign({}, this.props));
            case DebugMode.ThrowError:
                throw new Error('I failed you and for that i am deeply sorry');
            default:
                return React.createElement(RenderInfoViewer, __assign({}, this.props));
        }
    };
    return DebugPanel;
}(Component));
export { DebugPanel };
//# sourceMappingURL=DebugPanel.js.map