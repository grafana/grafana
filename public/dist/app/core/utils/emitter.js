import { EventEmitter } from 'eventemitter3';
var Emitter = /** @class */ (function () {
    function Emitter() {
        this.emitter = new EventEmitter();
    }
    Emitter.prototype.emit = function (name, data) {
        this.emitter.emit(name, data);
    };
    Emitter.prototype.on = function (name, handler, scope) {
        var _this = this;
        this.emitter.on(name, handler);
        if (scope) {
            var unbind_1 = scope.$on('$destroy', function () {
                _this.emitter.off(name, handler);
                unbind_1();
            });
        }
    };
    Emitter.prototype.removeAllListeners = function (evt) {
        this.emitter.removeAllListeners(evt);
    };
    Emitter.prototype.off = function (name, handler) {
        this.emitter.off(name, handler);
    };
    return Emitter;
}());
export { Emitter };
//# sourceMappingURL=emitter.js.map