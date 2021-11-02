import { __read } from "tslib";
import { useState } from 'react';
/** @internal */
export function useForceUpdate() {
    var _a = __read(useState(0), 2), _ = _a[0], setValue = _a[1]; // integer state
    return function () { return setValue(function (prevState) { return prevState + 1; }); }; // update the state to force render
}
//# sourceMappingURL=useForceUpdate.js.map