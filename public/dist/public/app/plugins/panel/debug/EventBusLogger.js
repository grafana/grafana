import { __extends, __values } from "tslib";
import React, { PureComponent } from 'react';
import { CustomScrollbar } from '@grafana/ui';
import { CircularVector, DataHoverEvent, DataHoverClearEvent, DataSelectEvent, } from '@grafana/data';
var counter = 100;
var EventBusLoggerPanel = /** @class */ (function (_super) {
    __extends(EventBusLoggerPanel, _super);
    function EventBusLoggerPanel(props) {
        var _this = _super.call(this, props) || this;
        _this.history = new CircularVector({ capacity: 40, append: 'head' });
        _this.eventObserver = {
            next: function (event) {
                var origin = event.origin;
                _this.history.add({
                    key: counter++,
                    type: event.type,
                    path: origin === null || origin === void 0 ? void 0 : origin.path,
                    payload: event.payload,
                });
                _this.setState({ counter: counter });
            },
        };
        _this.state = { counter: counter };
        var subs = [];
        subs.push(props.eventBus.getStream(DataHoverEvent).subscribe(_this.eventObserver));
        subs.push(props.eventBus.getStream(DataHoverClearEvent).subscribe(_this.eventObserver));
        subs.push(props.eventBus.getStream(DataSelectEvent).subscribe(_this.eventObserver));
        _this.subs = subs;
        return _this;
    }
    EventBusLoggerPanel.prototype.componentWillUnmount = function () {
        var e_1, _a;
        try {
            for (var _b = __values(this.subs), _c = _b.next(); !_c.done; _c = _b.next()) {
                var sub = _c.value;
                sub.unsubscribe();
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    };
    EventBusLoggerPanel.prototype.render = function () {
        return (React.createElement(CustomScrollbar, { autoHeightMin: "100%", autoHeightMax: "100%" }, this.history.map(function (v, idx) { return (React.createElement("div", { key: v.key },
            JSON.stringify(v.path),
            " ",
            v.type,
            " / X:",
            JSON.stringify(v.payload.x),
            " / Y:",
            JSON.stringify(v.payload.y))); })));
    };
    return EventBusLoggerPanel;
}(PureComponent));
export { EventBusLoggerPanel };
//# sourceMappingURL=EventBusLogger.js.map