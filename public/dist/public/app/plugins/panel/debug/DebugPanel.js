import React, { Component } from 'react';
import { CursorView } from './CursorView';
import { EventBusLoggerPanel } from './EventBusLogger';
import { RenderInfoViewer } from './RenderInfoViewer';
import { StateView } from './StateView';
import { DebugMode } from './panelcfg.gen';
export class DebugPanel extends Component {
    render() {
        const { options } = this.props;
        switch (options.mode) {
            case DebugMode.Events:
                return React.createElement(EventBusLoggerPanel, { eventBus: this.props.eventBus });
            case DebugMode.Cursor:
                return React.createElement(CursorView, { eventBus: this.props.eventBus });
            case DebugMode.State:
                return React.createElement(StateView, Object.assign({}, this.props));
            case DebugMode.ThrowError:
                throw new Error('I failed you and for that i am deeply sorry');
            default:
                return React.createElement(RenderInfoViewer, Object.assign({}, this.props));
        }
    }
}
//# sourceMappingURL=DebugPanel.js.map