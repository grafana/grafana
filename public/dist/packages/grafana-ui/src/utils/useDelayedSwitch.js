import { __read } from "tslib";
import { useEffect, useRef, useState } from 'react';
/**
 * Hook that delays changing of boolean switch to prevent too much time spent in "on" state. It is kind of a throttle
 * but you can specify different time for on and off throttling so this only allows a boolean values and also prefers
 * to stay "off" so turning "on" is always delayed while turning "off" is throttled.
 *
 * This is useful for showing loading elements to prevent it flashing too much in case of quick loading time or
 * prevent it flash if loaded state comes right after switch to loading.
 */
export function useDelayedSwitch(value, options) {
    if (options === void 0) { options = {}; }
    var _a = options.duration, duration = _a === void 0 ? 250 : _a, _b = options.delay, delay = _b === void 0 ? 250 : _b;
    var _c = __read(useState(value), 2), delayedValue = _c[0], setDelayedValue = _c[1];
    var onStartTime = useRef();
    useEffect(function () {
        var timeout;
        if (value) {
            // If toggling to "on" state we always setTimeout no matter how long we have been "off".
            timeout = setTimeout(function () {
                onStartTime.current = new Date();
                setDelayedValue(value);
            }, delay);
        }
        else {
            // If toggling to "off" state we check how much time we were already "on".
            var timeSpent = onStartTime.current ? Date.now() - onStartTime.current.valueOf() : 0;
            var turnOff = function () {
                onStartTime.current = undefined;
                setDelayedValue(value);
            };
            if (timeSpent >= duration) {
                // We already spent enough time "on" so change right away.
                turnOff();
            }
            else {
                timeout = setTimeout(turnOff, duration - timeSpent);
            }
        }
        return function () {
            if (timeout) {
                clearTimeout(timeout);
                timeout = undefined;
            }
        };
    }, [value, duration, delay]);
    return delayedValue;
}
//# sourceMappingURL=useDelayedSwitch.js.map