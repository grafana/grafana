import { __read, __spreadArray } from "tslib";
import { useState, useCallback, useMemo } from 'react';
import messageFromError from './messageFromError';
export default function useLastError() {
    var _a = __read(useState([]), 2), errors = _a[0], setErrors = _a[1];
    // Handles errors from any child components that request data to display their options
    var addError = useCallback(function (errorSource, error) {
        setErrors(function (errors) {
            var errorsCopy = __spreadArray([], __read(errors), false);
            var index = errors.findIndex(function (_a) {
                var _b = __read(_a, 1), vSource = _b[0];
                return vSource === errorSource;
            });
            // If there's already an error, remove it. If we're setting a new error
            // below, we'll move it to the front
            if (index > -1) {
                errorsCopy.splice(index, 1);
            }
            // And then add the new error to the top of the array. If error is defined, it was already
            // removed above.
            if (error) {
                errorsCopy.unshift([errorSource, error]);
            }
            return errorsCopy;
        });
    }, []);
    var errorMessage = useMemo(function () {
        var recentError = errors[0];
        return recentError && messageFromError(recentError[1]);
    }, [errors]);
    return [errorMessage, addError];
}
//# sourceMappingURL=useLastError.js.map