import { __read } from "tslib";
import { useState, useEffect } from 'react';
import { usePrevious } from 'react-use';
export function useShadowedState(outsideVal) {
    var _a = __read(useState(outsideVal), 2), currentVal = _a[0], setCurrentVal = _a[1];
    var prevOutsideVal = usePrevious(outsideVal);
    useEffect(function () {
        var isOutsideValChanged = prevOutsideVal !== outsideVal;
        // if the value changes from the outside, we accept it into the state
        // (we only set it if it is different from the current value)
        if (isOutsideValChanged && currentVal !== outsideVal) {
            setCurrentVal(outsideVal);
        }
    }, [outsideVal, currentVal, prevOutsideVal]);
    return [currentVal, setCurrentVal];
}
//# sourceMappingURL=useShadowedState.js.map