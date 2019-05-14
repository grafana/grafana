import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
var INTERVAL = 150;
var ElapsedTime = /** @class */ (function (_super) {
    tslib_1.__extends(ElapsedTime, _super);
    function ElapsedTime() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            elapsed: 0,
        };
        _this.tick = function () {
            var jetzt = Date.now();
            var elapsed = jetzt - _this.offset;
            _this.setState({ elapsed: elapsed });
        };
        return _this;
    }
    ElapsedTime.prototype.start = function () {
        this.offset = Date.now();
        this.timer = window.setInterval(this.tick, INTERVAL);
    };
    ElapsedTime.prototype.componentWillReceiveProps = function (nextProps) {
        if (nextProps.time) {
            clearInterval(this.timer);
        }
        else if (this.props.time) {
            this.start();
        }
    };
    ElapsedTime.prototype.componentDidMount = function () {
        this.start();
    };
    ElapsedTime.prototype.componentWillUnmount = function () {
        clearInterval(this.timer);
    };
    ElapsedTime.prototype.render = function () {
        var elapsed = this.state.elapsed;
        var _a = this.props, className = _a.className, time = _a.time;
        var value = (time || elapsed) / 1000;
        return React.createElement("span", { className: "elapsed-time " + className },
            value.toFixed(1),
            "s");
    };
    return ElapsedTime;
}(PureComponent));
export default ElapsedTime;
//# sourceMappingURL=ElapsedTime.js.map