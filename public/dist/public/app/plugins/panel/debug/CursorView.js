import { __extends } from "tslib";
import React, { Component } from 'react';
import { LegacyGraphHoverEvent, LegacyGraphHoverClearEvent, DataHoverEvent, DataHoverClearEvent, } from '@grafana/data';
import { Subscription } from 'rxjs';
import { CustomScrollbar } from '@grafana/ui';
import { DataHoverView } from '../geomap/components/DataHoverView';
var CursorView = /** @class */ (function (_super) {
    __extends(CursorView, _super);
    function CursorView() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.subscription = new Subscription();
        _this.state = {};
        return _this;
    }
    CursorView.prototype.componentDidMount = function () {
        var _this = this;
        var eventBus = this.props.eventBus;
        this.subscription.add(eventBus.subscribe(DataHoverEvent, function (event) {
            _this.setState({ event: event });
        }));
        this.subscription.add(eventBus.subscribe(DataHoverClearEvent, function (event) {
            _this.setState({ event: event });
        }));
        this.subscription.add(eventBus.subscribe(LegacyGraphHoverEvent, function (event) {
            _this.setState({ event: event });
        }));
        this.subscription.add(eventBus.subscribe(LegacyGraphHoverClearEvent, function (event) {
            _this.setState({ event: event });
        }));
    };
    CursorView.prototype.componentWillUnmount = function () {
        this.subscription.unsubscribe();
    };
    CursorView.prototype.render = function () {
        var _a;
        var event = this.state.event;
        if (!event) {
            return React.createElement("div", null, "no events yet");
        }
        var type = event.type, payload = event.payload, origin = event.origin;
        return (React.createElement(CustomScrollbar, { autoHeightMin: "100%", autoHeightMax: "100%" },
            React.createElement("h3", null,
                "Origin: ", (_a = origin) === null || _a === void 0 ? void 0 :
                _a.path),
            React.createElement("span", null,
                "Type: ",
                type),
            Boolean(payload) && (React.createElement(React.Fragment, null,
                React.createElement("pre", null, JSON.stringify(payload.point, null, '  ')),
                payload.data && (React.createElement(DataHoverView, { data: payload.data, rowIndex: payload.rowIndex, columnIndex: payload.columnIndex }))))));
    };
    return CursorView;
}(Component));
export { CursorView };
//# sourceMappingURL=CursorView.js.map