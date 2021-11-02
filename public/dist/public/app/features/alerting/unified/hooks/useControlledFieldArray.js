import { __read, __spreadArray } from "tslib";
import { useCallback } from 'react';
import { set } from 'lodash';
var EMPTY_ARRAY = [];
/*
 * react-hook-form's own useFieldArray is uncontrolled and super buggy.
 * this is a simple controlled version. It's dead simple and more robust at the cost of re-rendering the form
 * on every change to the sub forms in the array.
 * Warning: you'll have to take care of your own unique identiifer to use as `key` for the ReactNode array.
 * Using index will cause problems.
 */
export function useControlledFieldArray(options) {
    var _a, _b;
    var name = options.name, formAPI = options.formAPI, defaults = options.defaults, softDelete = options.softDelete;
    var watch = formAPI.watch, getValues = formAPI.getValues, reset = formAPI.reset, setValue = formAPI.setValue;
    var fields = (_b = (_a = watch(name)) !== null && _a !== void 0 ? _a : defaults) !== null && _b !== void 0 ? _b : EMPTY_ARRAY;
    var update = useCallback(function (updateFn) {
        var values = JSON.parse(JSON.stringify(getValues()));
        var newItems = updateFn(fields !== null && fields !== void 0 ? fields : []);
        reset(set(values, name, newItems));
    }, [getValues, name, reset, fields]);
    return {
        fields: fields,
        append: useCallback(function (values) { return update(function (fields) { return __spreadArray(__spreadArray([], __read(fields), false), [values], false); }); }, [update]),
        remove: useCallback(function (index) {
            if (softDelete) {
                setValue(name + "." + index + ".__deleted", true);
            }
            else {
                update(function (items) {
                    var newItems = items.slice();
                    newItems.splice(index, 1);
                    return newItems;
                });
            }
        }, [update, name, setValue, softDelete]),
    };
}
//# sourceMappingURL=useControlledFieldArray.js.map