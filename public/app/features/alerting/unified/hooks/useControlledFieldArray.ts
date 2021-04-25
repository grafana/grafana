import { useCallback } from 'react';
import { FormContextValues } from 'react-hook-form';

/*
 * react-hook-form's own useFieldArray is uncontrolled and super buggy.
 * this is a simple controlled version. It's dead simple and more robust at the cost of re-rendering the form
 * on every change to the sub forms in the array.
 * Warning: you'll have to take care of your own unique identiifer to use as `key` for the ReactNode array.
 * Using index will cause problems.
 */
export function useControlledFieldArray<R>(name: string, formAPI: FormContextValues<any>) {
  const { watch, getValues, reset } = formAPI;

  const items: R[] = watch(name);

  return {
    items,
    append: useCallback(
      (values: R) => {
        const existingValues = getValues({ nest: true });
        reset({
          ...existingValues,
          [name]: [...(existingValues[name] ?? []), values],
        });
      },
      [getValues, reset, name]
    ),
    remove: useCallback(
      (index: number) => {
        const values = getValues({ nest: true });
        const items = values[name] ?? [];
        items.splice(index, 1);
        reset({ ...values, [name]: items });
      },
      [getValues, reset, name]
    ),
  };
}
