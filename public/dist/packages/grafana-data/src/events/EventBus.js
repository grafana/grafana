import { __read, __spreadArray } from "tslib";
import EventEmitter from 'eventemitter3';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
/**
 * @alpha
 */
var EventBusSrv = /** @class */ (function () {
    function EventBusSrv() {
        this.emitter = new EventEmitter();
    }
    EventBusSrv.prototype.publish = function (event) {
        this.emitter.emit(event.type, event);
    };
    EventBusSrv.prototype.subscribe = function (typeFilter, handler) {
        return this.getStream(typeFilter).subscribe({ next: handler });
    };
    EventBusSrv.prototype.getStream = function (eventType) {
        var _this = this;
        return new Observable(function (observer) {
            var handler = function (event) {
                observer.next(event);
            };
            _this.emitter.on(eventType.type, handler);
            return function () {
                _this.emitter.off(eventType.type, handler);
            };
        });
    };
    EventBusSrv.prototype.newScopedBus = function (key, filter) {
        return new ScopedEventBus([key], this, filter);
    };
    /**
     * Legacy functions
     */
    EventBusSrv.prototype.emit = function (event, payload) {
        // console.log(`Deprecated emitter function used (emit), use $emit`);
        if (typeof event === 'string') {
            this.emitter.emit(event, { type: event, payload: payload });
        }
        else {
            this.emitter.emit(event.name, { type: event.name, payload: payload });
        }
    };
    EventBusSrv.prototype.on = function (event, handler, scope) {
        // console.log(`Deprecated emitter function used (on), use $on`);
        var _this = this;
        // need this wrapper to make old events compatible with old handlers
        handler.wrapper = function (emittedEvent) {
            handler(emittedEvent.payload);
        };
        if (typeof event === 'string') {
            this.emitter.on(event, handler.wrapper);
        }
        else {
            this.emitter.on(event.name, handler.wrapper);
        }
        if (scope) {
            var unbind_1 = scope.$on('$destroy', function () {
                _this.off(event, handler);
                unbind_1();
            });
        }
    };
    EventBusSrv.prototype.off = function (event, handler) {
        if (typeof event === 'string') {
            this.emitter.off(event, handler.wrapper);
            return;
        }
        this.emitter.off(event.name, handler.wrapper);
    };
    EventBusSrv.prototype.removeAllListeners = function () {
        this.emitter.removeAllListeners();
    };
    return EventBusSrv;
}());
export { EventBusSrv };
/**
 * Wraps EventBus and adds a source to help with identifying if a subscriber should react to the event or not.
 */
var ScopedEventBus = /** @class */ (function () {
    // The path is not yet exposed, but can be used to indicate nested groups and support faster filtering
    function ScopedEventBus(path, eventBus, filter) {
        var _this = this;
        this.path = path;
        this.eventBus = eventBus;
        this.filter = function (event) {
            if (_this.filterConfig.onlyLocal) {
                return event.origin === _this;
            }
            return true;
        };
        this.filterConfig = filter !== null && filter !== void 0 ? filter : { onlyLocal: false };
    }
    ScopedEventBus.prototype.publish = function (event) {
        if (!event.origin) {
            event.origin = this;
        }
        this.eventBus.publish(event);
    };
    ScopedEventBus.prototype.getStream = function (eventType) {
        return this.eventBus.getStream(eventType).pipe(filter(this.filter));
    };
    // syntax sugar
    ScopedEventBus.prototype.subscribe = function (typeFilter, handler) {
        return this.getStream(typeFilter).subscribe({ next: handler });
    };
    ScopedEventBus.prototype.removeAllListeners = function () {
        this.eventBus.removeAllListeners();
    };
    /**
     * Creates a nested event bus structure
     */
    ScopedEventBus.prototype.newScopedBus = function (key, filter) {
        return new ScopedEventBus(__spreadArray(__spreadArray([], __read(this.path), false), [key], false), this, filter);
    };
    return ScopedEventBus;
}());
//# sourceMappingURL=EventBus.js.map