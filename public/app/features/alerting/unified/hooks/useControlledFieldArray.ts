import { set } from 'lodash';
import { useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';

interface Options<R> {
  name: string;
  formAPI: UseFormReturn<any>;
  defaults?: R[];

  // if true, sets `__deleted: true` but does not remove item from the array in values
  softDelete?: boolean;
}

export type ControlledField<R> = R & {
  __deleted?: boolean;
};

const EMPTY_ARRAY = [] as const;

/*
 * react-hook-form's own useFieldArray is uncontrolled and super buggy.
 * this is a simple controlled version. It's dead simple and more robust at the cost of re-rendering the form
 * on every change to the sub forms in the array.
 * Warning: you'll have to take care of your own unique identiifer to use as `key` for the ReactNode array.
 * Using index will cause problems.
 */
export function useControlledFieldArray<R>(options: Options<R>) {
  const { name, formAPI, defaults, softDelete } = options;
  const { watch, getValues, reset, setValue } = formAPI;

  const fields: Array<ControlledField<R>> = watch(name) ?? defaults ?? EMPTY_ARRAY;

  const update = useCallback(
    (updateFn: (fields: R[]) => R[]) => {
      const values = JSON.parse(JSON.stringify(getValues()));
      const newItems = updateFn(fields ?? []);
      reset(set(values, name, newItems));
    },
    [getValues, name, reset, fields]
  );

  return {
    fields,
    append: useCallback((values: R) => update((fields) => [...fields, values]), [update]),
    remove: useCallback(
      (index: number) => {
        if (softDelete) {
          setValue(`${name}.${index}.__deleted`, true);
        } else {
          update((items) => {
            const newItems = items.slice();
            newItems.splice(index, 1);
            return newItems;
          });
        }
      },
      [update, name, setValue, softDelete]
    ),
  };
}
