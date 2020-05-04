import React, { useEffect } from 'react';
import { useForm, Mode, OnSubmit, DeepPartial } from 'react-hook-form';
import { FormAPI } from '../../types';
import { css } from 'emotion';

interface FormProps<T> {
  validateOn?: Mode;
  validateOnMount?: boolean;
  validateFieldsOnMount?: string[];
  defaultValues?: DeepPartial<T>;
  onSubmit: OnSubmit<T>;
  children: (api: FormAPI<T>) => React.ReactNode;
  /** Sets max-width for container. Use it instead of setting individual widths on inputs.*/
  maxWidth?: number;
}

export function Form<T>({
  defaultValues,
  onSubmit,
  validateOnMount = false,
  validateFieldsOnMount,
  children,
  validateOn = 'onSubmit',
  maxWidth = 400,
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

  return (
    <form
      className={css`
        max-width: ${maxWidth}px;
        width: 100%;
      `}
      onSubmit={handleSubmit(onSubmit)}
    >
      {children({ register, errors, control, getValues, formState })}
    </form>
  );
}
