import { __read } from "tslib";
import { useCallback, useState } from 'react';
export var ApiKeysController = function (_a) {
    var children = _a.children;
    var _b = __read(useState(false), 2), isAdding = _b[0], setIsAdding = _b[1];
    var toggleIsAdding = useCallback(function () {
        setIsAdding(!isAdding);
    }, [isAdding]);
    return children({ isAdding: isAdding, toggleIsAdding: toggleIsAdding });
};
//# sourceMappingURL=ApiKeysController.js.map