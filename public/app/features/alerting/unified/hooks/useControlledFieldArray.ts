import { useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';

import { set } from 'lodash';

/*
 * react-hook-form's own useFieldArray is uncontrolled and super buggy.
 * this is a simple controlled version. It's dead simple and more robust at the cost of re-rendering the form
 * on every change to the sub forms in the array.
 * Warning: you'll have to take care of your own unique identiifer to use as `key` for the ReactNode array.
 * Using index will cause problems.
 */
export function useControlledFieldArray<R>(name: string, formAPI: UseFormReturn<any>) {
  const { watch, getValues, reset } = formAPI;

  const fields: R[] | undefined = watch(name);

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
      (fields: number) =>
        update((items) => {
          const newItems = items.slice();
          newItems.splice(fields, 1);
          return newItems;
        }),
      [update]
    ),
  };
}
