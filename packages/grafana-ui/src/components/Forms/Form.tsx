import React, { useEffect } from 'react';
import { useForm, Mode, OnSubmit, DeepPartial, FormContextValues } from 'react-hook-form';

type FormAPI<T> = Pick<FormContextValues<T>, 'register' | 'errors' | 'control'>;

interface FormProps<T> {
  validateOn?: Mode;
  defaultValues?: DeepPartial<T>;
  onSubmit: OnSubmit<T>;
  children: (api: FormAPI<T>) => React.ReactNode;
}

export function Form<T>({ defaultValues, onSubmit, children, validateOn = 'onSubmit' }: FormProps<T>) {
  const { handleSubmit, register, errors, control, reset, getValues } = useForm<T>({
    mode: validateOn,
    defaultValues,
  });

  useEffect(() => {
    reset({ ...getValues(), ...defaultValues });
  }, [defaultValues]);

  return <form onSubmit={handleSubmit(onSubmit)}>{children({ register, errors, control })}</form>;
}
