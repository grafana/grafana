import { useCallback } from 'react';
import { FormContextValues } from 'react-hook-form';

import { set } from 'lodash';

/*
 * react-hook-form's own useFieldArray is uncontrolled and super buggy.
 * this is a simple controlled version. It's dead simple and more robust at the cost of re-rendering the form
 * on every change to the sub forms in the array.
 * Warning: you'll have to take care of your own unique identiifer to use as `key` for the ReactNode array.
 * Using index will cause problems.
 */
export function useControlledFieldArray<R>(name: string, formAPI: FormContextValues<any>) {
  const { watch, getValues, reset } = formAPI;

  const items: R[] | undefined = watch(name);

  const update = useCallback(
    (updateFn: (items: R[]) => R[]) => {
      const values = JSON.parse(JSON.stringify(getValues({ nest: true })));
      const newItems = updateFn(items ?? []);
      reset(set(values, name, newItems));
    },
    [getValues, name, reset, items]
  );

  return {
    items,
    append: useCallback((values: R) => update((items) => [...items, values]), [update]),
    remove: useCallback(
      (index: number) =>
        update((items) => {
          const newItems = items.slice();
          newItems.splice(index, 1);
          return newItems;
        }),
      [update]
    ),
  };
}
