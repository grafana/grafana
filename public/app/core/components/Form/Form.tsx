import { css } from '@emotion/css';
import React, { HTMLProps, useEffect } from 'react';
import {
  useForm,
  Mode,
  DefaultValues,
  SubmitHandler,
  FieldValues,
  UseFormReturn,
  FieldErrors,
  FieldPath,
} from 'react-hook-form';

export type FormAPI<T extends FieldValues> = Omit<UseFormReturn<T>, 'handleSubmit'> & {
  errors: FieldErrors<T>;
};

interface FormProps<T extends FieldValues> extends Omit<HTMLProps<HTMLFormElement>, 'onSubmit' | 'children'> {
  validateOn?: Mode;
  validateOnMount?: boolean;
  validateFieldsOnMount?: FieldPath<T> | Array<FieldPath<T>>;
  defaultValues?: DefaultValues<T>;
  onSubmit: SubmitHandler<T>;
  children: (api: FormAPI<T>) => React.ReactNode;
  /** Sets max-width for container. Use it instead of setting individual widths on inputs.*/
  maxWidth?: number | 'none';
}

export function Form<T extends FieldValues>({
  defaultValues,
  onSubmit,
  validateOnMount = false,
  validateFieldsOnMount,
  children,
  validateOn = 'onSubmit',
  maxWidth = 600,
  ...htmlProps
}: FormProps<T>) {
  const { handleSubmit, trigger, formState, ...rest } = useForm<T>({
    mode: validateOn,
    defaultValues,
  });

  useEffect(() => {
    if (validateOnMount) {
      trigger(validateFieldsOnMount);
    }
  }, [trigger, validateFieldsOnMount, validateOnMount]);

  return (
    <form
      className={css({
        maxWidth: maxWidth !== 'none' ? maxWidth + 'px' : maxWidth,
        width: '100%',
      })}
      onSubmit={handleSubmit(onSubmit)}
      {...htmlProps}
    >
      {children({ errors: formState.errors, formState, trigger, ...rest })}
    </form>
  );
}
