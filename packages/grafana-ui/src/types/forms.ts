import { FormContextValues, FieldValues, ArrayField } from 'react-hook-form';
export { OnSubmit as FormsOnSubmit, FieldErrors as FormFieldErrors } from 'react-hook-form';

export type FormAPI<T> = Pick<
  FormContextValues<T>,
  'register' | 'errors' | 'control' | 'formState' | 'getValues' | 'watch'
>;

type FieldArrayValue = Partial<FieldValues> | Array<Partial<FieldValues>>;

export interface FieldArrayApi {
  fields: Array<Partial<ArrayField<FieldValues, 'id'>>>;
  append: (value: FieldArrayValue) => void;
  prepend: (value: FieldArrayValue) => void;
  remove: (index?: number | number[]) => void;
  swap: (indexA: number, indexB: number) => void;
  move: (from: number, to: number) => void;
  insert: (index: number, value: FieldArrayValue) => void;
}
