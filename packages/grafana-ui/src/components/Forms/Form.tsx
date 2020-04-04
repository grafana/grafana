import React, { useEffect } from 'react';
import { useForm, Mode, OnSubmit, DeepPartial } from 'react-hook-form';
import { FormAPI } from '../../types';

interface FormProps<T> {
  validateOn?: Mode;
  validateOnMount?: boolean;
  validateFieldsOnMount?: string[];
  defaultValues?: DeepPartial<T>;
  onSubmit: OnSubmit<T>;
  children: (api: FormAPI<T>) => React.ReactNode;
}

export function Form<T>({
  defaultValues,
  onSubmit,
  validateOnMount = false,
  validateFieldsOnMount,
  children,
  validateOn = 'onSubmit',
}: FormProps<T>) {
  const { handleSubmit, register, errors, control, triggerValidation, getValues, formState } = useForm<T>({
    mode: validateOn,
    defaultValues,
  });

  useEffect(() => {
    if (validateOnMount) {
      triggerValidation(validateFieldsOnMount);
    }
  }, []);

  return <form onSubmit={handleSubmit(onSubmit)}>{children({ register, errors, control, getValues, formState })}</form>;
}
