import React, { useEffect } from 'react';
import { useForm, Mode, OnSubmit, DeepPartial, FormContextValues } from 'react-hook-form';

type FormAPI<T> = Pick<FormContextValues<T>, 'register' | 'errors' | 'control'>;

interface FormProps<T> {
  validateOn?: Mode;
  defaultValues?: DeepPartial<T>;
  onSubmit: OnSubmit<T>;
  children: (api: FormAPI<T>) => React.ReactNode;
}

export function Form<T>({ validateOn, defaultValues, onSubmit, children }: FormProps<T>) {
  const { handleSubmit, register, errors, control, reset, getValues } = useForm<T>({
    mode: validateOn || 'onSubmit',
    defaultValues,
  });

  useEffect(() => {
    reset({ ...getValues(), ...defaultValues });
  }, [defaultValues]);

  return <form onSubmit={handleSubmit(onSubmit)}>{children({ register, errors, control })}</form>;
}
