import React, { HTMLProps, useEffect } from 'react';
import { useForm, Mode, OnSubmit, DeepPartial, FormContext } from 'react-hook-form';
import { FormAPI } from '../../types';
import { css } from 'emotion';

interface FormProps<T> extends Omit<HTMLProps<HTMLFormElement>, 'onSubmit'> {
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
  ...htmlProps
}: FormProps<T>) {
  const {
    handleSubmit,
    register,
    errors,
    control,
    triggerValidation,
    getValues,
    formState,
    watch,
    ...otherFormMethods
  } = useForm<T>({
    mode: validateOn,
    defaultValues,
  });

  useEffect(() => {
    if (validateOnMount) {
      triggerValidation(validateFieldsOnMount);
    }
  }, []);

  return (
    <FormContext
      handleSubmit={handleSubmit}
      register={register}
      errors={errors}
      control={control}
      triggerValidation={triggerValidation}
      getValues={getValues}
      formState={formState}
      watch={watch}
      {...otherFormMethods}
    >
      <form
        className={css`
          max-width: ${maxWidth}px;
          width: 100%;
        `}
        onSubmit={handleSubmit(onSubmit)}
        {...htmlProps}
      >
        {children({ register, errors, control, getValues, formState, watch })}
      </form>
    </FormContext>
  );
}
