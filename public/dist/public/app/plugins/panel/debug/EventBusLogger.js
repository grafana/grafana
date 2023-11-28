import React, { PureComponent } from 'react';
import { CircularVector, DataHoverEvent, DataHoverClearEvent, DataSelectEvent, } from '@grafana/data';
import { CustomScrollbar } from '@grafana/ui';
let counter = 100;
export class EventBusLoggerPanel extends PureComponent {
    constructor(props) {
        super(props);
        this.history = new CircularVector({ capacity: 40, append: 'head' });
        this.eventObserver = {
            next: (event) => {
                const origin = event.origin;
                this.history.add({
                    key: counter++,
                    type: event.type,
                    path: origin === null || origin === void 0 ? void 0 : origin.path,
                    payload: event.payload,
                });
                this.setState({ counter });
            },
        };
        this.state = { counter };
        const subs = [];
        subs.push(props.eventBus.getStream(DataHoverEvent).subscribe(this.eventObserver));
        subs.push(props.eventBus.getStream(DataHoverClearEvent).subscribe(this.eventObserver));
        subs.push(props.eventBus.getStream(DataSelectEvent).subscribe(this.eventObserver));
        this.subs = subs;
    }
    componentWillUnmount() {
        for (const sub of this.subs) {
            sub.unsubscribe();
        }
    }
    render() {
        return (React.createElement(CustomScrollbar, { autoHeightMin: "100%", autoHeightMax: "100%" }, this.history.map((v, idx) => (React.createElement("div", { key: v.key },
            JSON.stringify(v.path),
            " ",
            v.type,
            " / X:",
            JSON.stringify(v.payload.x),
            " / Y:",
            JSON.stringify(v.payload.y))))));
    }
}
//# sourceMappingURL=EventBusLogger.js.map