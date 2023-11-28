import { set } from 'lodash';
import { useCallback } from 'react';
const EMPTY_ARRAY = [];
/*
 * react-hook-form's own useFieldArray is uncontrolled and super buggy.
 * this is a simple controlled version. It's dead simple and more robust at the cost of re-rendering the form
 * on every change to the sub forms in the array.
 * Warning: you'll have to take care of your own unique identiifer to use as `key` for the ReactNode array.
 * Using index will cause problems.
 */
export function useControlledFieldArray(options) {
    var _a, _b;
    const { name, formAPI, defaults, softDelete } = options;
    const { watch, getValues, reset, setValue } = formAPI;
    const fields = (_b = (_a = watch(name)) !== null && _a !== void 0 ? _a : defaults) !== null && _b !== void 0 ? _b : EMPTY_ARRAY;
    const update = useCallback((updateFn) => {
        const values = JSON.parse(JSON.stringify(getValues()));
        const newItems = updateFn(fields !== null && fields !== void 0 ? fields : []);
        reset(set(values, name, newItems));
    }, [getValues, name, reset, fields]);
    return {
        fields,
        append: useCallback((values) => update((fields) => [...fields, values]), [update]),
        remove: useCallback((index) => {
            if (softDelete) {
                setValue(`${name}.${index}.__deleted`, true);
            }
            else {
                update((items) => {
                    const newItems = items.slice();
                    newItems.splice(index, 1);
                    return newItems;
                });
            }
        }, [update, name, setValue, softDelete]),
    };
}
//# sourceMappingURL=useControlledFieldArray.js.map