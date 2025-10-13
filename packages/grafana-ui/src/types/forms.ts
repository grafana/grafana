import { UseFormReturn, FieldValues, FieldErrors, FieldArrayMethodProps } from 'react-hook-form';
export type { SubmitHandler as FormsOnSubmit, FieldErrors as FormFieldErrors } from 'react-hook-form';

/**
 * @deprecated use the types from react-hook-form instead
 */
export type FormAPI<T extends FieldValues> = Omit<UseFormReturn<T>, 'handleSubmit'> & {
  errors: FieldErrors<T>;
};

type FieldArrayValue = Partial<FieldValues> | Array<Partial<FieldValues>>;

/**
 * @deprecated use the types from react-hook-form instead
 */
export interface FieldArrayApi {
  fields: Array<Record<string, any>>;
  append: (value: FieldArrayValue, options?: FieldArrayMethodProps) => void;
  prepend: (value: FieldArrayValue) => void;
  remove: (index?: number | number[]) => void;
  swap: (indexA: number, indexB: number) => void;
  move: (from: number, to: number) => void;
  insert: (index: number, value: FieldArrayValue) => void;
}
