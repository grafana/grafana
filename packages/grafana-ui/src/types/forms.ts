import { FormContextValues } from 'react-hook-form';
export { OnSubmit as FormsOnSubmit, FieldErrors as FormFieldErrors } from 'react-hook-form';

export type FormAPI<T> = Pick<FormContextValues<T>, 'register' | 'errors' | 'control' | 'formState' | 'getValues'>;
