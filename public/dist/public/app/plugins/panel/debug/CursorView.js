import React, { Component } from 'react';
import { Subscription } from 'rxjs';
import { LegacyGraphHoverEvent, LegacyGraphHoverClearEvent, DataHoverEvent, DataHoverClearEvent, } from '@grafana/data';
import { CustomScrollbar } from '@grafana/ui';
import { DataHoverView } from 'app/features/visualization/data-hover/DataHoverView';
export class CursorView extends Component {
    constructor() {
        super(...arguments);
        this.subscription = new Subscription();
        this.state = {};
    }
    componentDidMount() {
        const { eventBus } = this.props;
        this.subscription.add(eventBus.subscribe(DataHoverEvent, (event) => {
            this.setState({ event });
        }));
        this.subscription.add(eventBus.subscribe(DataHoverClearEvent, (event) => {
            this.setState({ event });
        }));
        this.subscription.add(eventBus.subscribe(LegacyGraphHoverEvent, (event) => {
            this.setState({ event });
        }));
        this.subscription.add(eventBus.subscribe(LegacyGraphHoverClearEvent, (event) => {
            this.setState({ event });
        }));
    }
    componentWillUnmount() {
        this.subscription.unsubscribe();
    }
    render() {
        const { event } = this.state;
        if (!event) {
            return React.createElement("div", null, "no events yet");
        }
        const { type, payload, origin } = event;
        return (React.createElement(CustomScrollbar, { autoHeightMin: "100%", autoHeightMax: "100%" },
            React.createElement("h3", null,
                "Origin: ", origin === null || origin === void 0 ? void 0 :
                origin.path),
            React.createElement("span", null,
                "Type: ",
                type),
            Boolean(payload) && (React.createElement(React.Fragment, null,
                React.createElement("pre", null, JSON.stringify(payload.point, null, '  ')),
                payload.data && (React.createElement(DataHoverView, { data: payload.data, rowIndex: payload.rowIndex, columnIndex: payload.columnIndex }))))));
    }
}
//# sourceMappingURL=CursorView.js.map